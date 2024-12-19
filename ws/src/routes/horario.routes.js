const express = require('express');
const router = express.Router();
const Horario = require('../models/horario');
const ColaboradorServico = require('../models/relationship/colaboradorServico');
const moment = require('moment');
const _ = require('lodash');

// Rota para criar um novo horário
router.post('/', async (req, res) => {
  try {
    const { salaoId, dia, hora } = req.body;

    // Verifica se já existe um horário para o salão no mesmo dia e hora
    const existingHorario = await Horario.findOne({ salaoId, dia, hora });
    if (existingHorario) {
      return res.json({ error: true, message: 'Já existe um horário agendado para esse dia e hora.' });
    }

    // Se não existir, cria um novo horário
    await new Horario(req.body).save();
    res.json({ error: false });
  } catch (err) {
    res.json({ error: true, message: err.message });
  }
});

// Rota para buscar horários de um salão
router.get('/salao/:salaoId', async (req, res) => {
  try {
    const { salaoId } = req.params;

    const horarios = await Horario.find({ salaoId });

    res.json({ error: false, horarios });
  } catch (err) {
    res.json({ error: true, message: err.message });
  }
});

// Rota para atualizar um horário
router.put('/:horarioId', async (req, res) => {
  try {
    const { horarioId } = req.params;
    const horario = req.body;

    // Atualiza o horário com o ID fornecido
    await Horario.findByIdAndUpdate(horarioId, horario);

    res.json({ error: false });
  } catch (err) {
    res.json({ error: true, message: err.message });
  }
});

// Rota para buscar colaboradores disponíveis para determinados serviços
router.post('/colaboradores', async (req, res) => {
  try {
    const colaboradores = await ColaboradorServico.find({
      servicoId: { $in: req.body.servicos },
      status: 'A', // Somente colaboradores ativos
    })
      .populate('colaboradorId', 'nome')
      .select('colaboradorId -_id');

    // Remove colaboradores duplicados
    const listaColaboradores = _.uniqBy(colaboradores, (c) =>
      c.colaboradorId._id.toString()
    ).map((c) => ({ label: c.colaboradorId.nome, value: c.colaboradorId._id }));

    res.json({ error: false, colaboradores: listaColaboradores });
  } catch (err) {
    res.json({ error: true, message: err.message });
  }
});

// Rota para excluir um horário
router.delete('/:horarioId', async (req, res) => {
  try {
    const { horarioId } = req.params;
    await Horario.findByIdAndDelete(horarioId);
    res.json({ error: false });
  } catch (err) {
    res.json({ error: true, message: err.message });
  }
});

module.exports = router;
