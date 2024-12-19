const express = require('express');
const router = express.Router();
const Horario = require('../models/horario');
const Agendamento = require('../models/agendamento');
const Cliente = require('../models/cliente');
const Salao = require('../models/salao');
const Servico = require('../models/servico');
const Colaborador = require('../models/colaborador');

const moment = require('moment');
const mongoose = require('mongoose');
const _ = require('lodash');

const pagarme = require('../services/pagarme');
const keys = require('../data/keys.json');
const util = require('../util');

// MULTER - Configuração para upload de arquivos
const multer = require('multer');
const path = require('path');

// Configuração do armazenamento do Multer
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const uploadPath = path.join(__dirname, '../uploads');  // Pasta de upload
    cb(null, uploadPath);
  },
  filename: function (req, file, cb) {
    cb(null, Date.now() + '-' + file.originalname);  // Nome do arquivo
  }
});

// Configuração do Multer
const upload = multer({ storage: storage });

// Rota para filtro de agendamentos
router.post('/filter', async (req, res) => {
  try {
    const { range, salaoId } = req.body;

    const agendamentos = await Agendamento.find({
      status: 'A',
      salaoId,
      data: {
        $gte: moment(range.start).startOf('day'),
        $lte: moment(range.end).endOf('day'),
      },
    }).populate([
      { path: 'servicoId', select: 'titulo duracao' },
      { path: 'colaboradorId', select: 'nome' },
      { path: 'clienteId', select: 'nome' },
    ]);

    res.json({ error: false, agendamentos });
  } catch (err) {
    res.json({ error: true, message: err.message });
  }
});

// Rota para criar agendamento (exemplo de integração com Multer)
router.post('/', upload.single('arquivo'), async (req, res) => { // 'arquivo' é o campo do formulário onde o arquivo será enviado
  const db = new mongoose.connection;
  const session = await db.startSession();
  session.startTransaction();

  try {
    const { clienteId, salaoId, servicoId, colaboradorId } = req.body;

    // O arquivo enviado pelo Multer estará disponível em req.file
    console.log(req.file); // Aqui você pode acessar as informações do arquivo

    const cliente = await Cliente.findById(clienteId).select('nome endereco customerId');
    const salao = await Salao.findById(salaoId).select('recipientId');
    const servico = await Servico.findById(servicoId).select('preco titulo comissao');
    const colaborador = await Colaborador.findById(colaboradorId).select('recipientId');

    // Cálculo do preço total da transação
    const precoFinal = util.toCents(servico.preco) * 100;

    // Regras de split do colaborador
    const colaboradoreSplitRule = {
      recipient_id: colaborador.recipientId,
      amount: parseInt(precoFinal * (servico.comissao / 100)),
    };

    // Criando pagamento mestre
    const createPayment = await pagarme('/transactions', {
      amount: precoFinal,
      card_number: '4111111111111111',
      card_cvv: '123',
      card_expiration_date: '0922',
      card_holder_name: 'Morpheus Fishburne',
      customer: { id: cliente.customerId },
      billing: {
        name: cliente.nome,
        address: {
          country: cliente.endereco.pais.toLowerCase(),
          state: cliente.endereco.uf.toLowerCase(),
          city: cliente.endereco.cidade,
          street: cliente.endereco.logradouro,
          street_number: cliente.endereco.numero,
          zipcode: cliente.endereco.cep,
        },
      },
      items: [{
        id: servicoId,
        title: servico.titulo,
        unit_price: precoFinal,
        quantity: 1,
        tangible: false,
      }],
      split_rules: [
        { recipient_id: salao.recipientId, amount: precoFinal - keys.app_fee - colaboradoreSplitRule.amount },
        colaboradoreSplitRule,
        { recipient_id: keys.recipient_id, amount: keys.app_fee, charge_processing_fee: false },
      ],
    });

    if (createPayment.error) {
      throw { message: createPayment.message };
    }

    // Criando o agendamento
    let agendamento = { ...req.body, transactionId: createPayment.data.id, comissao: servico.comissao, valor: servico.preco };
    await new Agendamento(agendamento).save();

    await session.commitTransaction();
    session.endSession();
    res.json({ error: false, agendamento: createPayment.data });
  } catch (err) {
    await session.abortTransaction();
    session.endSession();
    res.json({ error: true, message: err.message });
  }
});

// Rota para pegar dias disponíveis
router.post('/dias-disponiveis', async (req, res) => {
  try {
    const { data, salaoId, servicoId } = req.body;
    const horarios = await Horario.find({ salaoId });
    const servico = await Servico.findById(servicoId).select('duracao');
    let colaboradores = [];
    let agenda = [];
    let lastDay = moment(data);

    // Duração do serviço em minutos
    const servicoDuracao = util.hourToMinutes(moment(servico.duracao).format('HH:mm'));
    const servicoDuracaoSlots = util.sliceMinutes(moment(servico.duracao), moment(servico.duracao).add(servicoDuracao, 'minutes'), util.SLOT_DURATION, false).length;

    for (let i = 0; i <= 365 && agenda.length <= 7; i++) {
      const espacosValidos = horarios.filter((h) => {
        // Verifica dia da semana e especialidade disponível
        const diaSemanaDisponivel = h.dias.includes(moment(lastDay).day());
        const servicosDisponiveis = h.especialidades.includes(servicoId);
        return diaSemanaDisponivel && servicosDisponiveis;
      });

      if (espacosValidos.length > 0) {
        let todosHorariosDia = {};

        // Preenche horários disponíveis dos colaboradores
        for (let espaco of espacosValidos) {
          for (let colaborador of espaco.colaboradores) {
            if (!todosHorariosDia[colaborador._id]) {
              todosHorariosDia[colaborador._id] = [];
            }
            todosHorariosDia[colaborador._id] = [
              ...todosHorariosDia[colaborador._id],
              ...util.sliceMinutes(
                util.mergeDateTime(lastDay, espaco.inicio),
                util.mergeDateTime(lastDay, espaco.fim),
                util.SLOT_DURATION
              ),
            ];
          }
        }

        // Filtrando horários ocupados
        for (let colaboradorKey of Object.keys(todosHorariosDia)) {
          const agendamentos = await Agendamento.find({
            colaboradorId: colaboradorKey,
            data: {
              $gte: moment(lastDay).startOf('day'),
              $lte: moment(lastDay).endOf('day'),
            },
          }).select('data -_id');

          let horariosOcupado = agendamentos.map((a) => ({
            inicio: moment(a.data),
            fim: moment(a.data).add(servicoDuracao, 'minutes'),
          }));

          horariosOcupado = horariosOcupado
            .map((h) => util.sliceMinutes(h.inicio, h.fim, util.SLOT_DURATION, false))
            .flat();

          let horariosLivres = util.splitByValue(
            _.uniq(
              todosHorariosDia[colaboradorKey].map((h) => {
                return horariosOcupado.includes(h) ? '-' : h;
              })
            ),
            '-'
          );

          horariosLivres = horariosLivres
            .filter((h) => h.length >= servicoDuracaoSlots)
            .flat();

          horariosLivres = horariosLivres.map((slot) =>
            slot.filter((horario, index) => slot.length - index >= servicoDuracaoSlots)
          );

          horariosLivres = _.chunk(horariosLivres, 2);

          // Remover colaborador se não tiver horário disponível
          if (horariosLivres.length === 0) {
            todosHorariosDia = _.omit(todosHorariosDia, colaboradorKey);
          } else {
            todosHorariosDia[colaboradorKey] = horariosLivres;
          }
        }

        // Adiciona os colaboradores disponíveis ao agendamento
        const totalColaboradores = Object.keys(todosHorariosDia).length;

        if (totalColaboradores > 0) {
          colaboradores.push(Object.keys(todosHorariosDia));
          agenda.push({ [moment(lastDay).format('YYYY-MM-DD')]: todosHorariosDia });
        }
      }

      lastDay = moment(lastDay).add(1, 'day');
    }

    colaboradores = await Colaborador.find({
      _id: { $in: _.uniq(colaboradores.flat()) },
    }).select('nome foto');

    colaboradores = colaboradores.map((c) => ({
      ...c._doc,
      nome: c.nome.split(' ')[0],
    }));

    res.json({ error: false, colaboradores, agenda });
  } catch (err) {
    res.json({ error: true, message: err.message });
  }
});

module.exports = router;
