const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const Cliente = require('../models/cliente');
const SalaoCliente = require('../models/relationship/salaoCliente');
const moment = require('moment');
const pagarme = require('../services/pagarme');

router.post('/', async (req, res) => {
  const db = mongoose.connection;
  const session = await db.startSession();
  session.startTransaction();

  try {
    const { cliente, salaoId } = req.body;
    let newClient = null;

    // Verifica se o cliente já existe
    const existentClient = await Cliente.findOne({
      $or: [
        { email: cliente.email },
        { telefone: cliente.telefone },
      ],
    });

    if (!existentClient) {
      const _id = new mongoose.Types.ObjectId();
      const pagarmeCliente = await pagarme('/customers', {
        external_id: _id,
        name: cliente.nome,
        type: cliente.documento.tipo === 'cpf' ? 'individual' : 'corporation',
        country: 'br',
        email: cliente.email,
        documents: [
          {
            type: cliente.documento.tipo,
            number: cliente.documento.numero,
          },
        ],
        phone_numbers: ['+55' + cliente.telefone],
        birthday: cliente.dataNascimento,
      });

      if (pagarmeCliente.error) {
        throw new Error(`Erro ao criar cliente no Pagar.me: ${pagarmeCliente.message}`);
      }

      // Criação do cliente no banco de dados
      newClient = await new Cliente({
        _id,
        ...cliente,
        customerId: pagarmeCliente.data.id,
      }).save({ session });
    }

    const clienteId = existentClient ? existentClient._id : newClient._id;

    // Verifica a relação entre o cliente e o salão
    const existentRelationship = await SalaoCliente.findOne({
      salaoId,
      clienteId,
    });

    if (!existentRelationship) {
      await new SalaoCliente({
        salaoId,
        clienteId,
      }).save({ session });
    } else if (existentRelationship.status === 'I') {
      // Se o vínculo for inativo, atualiza para ativo
      await SalaoCliente.findOneAndUpdate(
        {
          salaoId,
          clienteId,
        },
        { status: 'A' },
        { session }
      );
    }

    await session.commitTransaction();
    session.endSession();

    // Retorna sucesso ou erro
    if (
      existentRelationship &&
      existentRelationship.status === 'A' &&
      existentClient
    ) {
      res.json({ error: true, message: 'Cliente já cadastrado no salão!' });
    } else {
      res.json({ error: false, message: 'Cliente cadastrado com sucesso!' });
    }
  } catch (err) {
    await session.abortTransaction();
    session.endSession();
    res.json({ error: true, message: err.message });
  }
});

router.post('/filter', async (req, res) => {
  try {
    // Aplica os filtros para buscar clientes
    const clientes = await Cliente.find(req.body.filters);
    res.json({ error: false, clientes });
  } catch (err) {
    res.json({ error: true, message: err.message });
  }
});

router.get('/salao/:salaoId', async (req, res) => {
  try {
    // Busca os clientes vinculados a um salão específico
    const clientes = await SalaoCliente.find({
      salaoId: req.params.salaoId,
      status: 'A',
    })
      .populate('clienteId')
      .select('clienteId');

    res.json({
      error: false,
      clientes: clientes.map((c) => ({
        ...c.clienteId._doc,
        vinculoId: c._id,
        dataCadastro: moment(c.dataCadastro).format('DD/MM/YYYY'),
      })),
    });
  } catch (err) {
    res.json({ error: true, message: err.message });
  }
});

router.delete('/vinculo/:id', async (req, res) => {
  try {
    // Desativa o vínculo entre cliente e salão
    const updatedRelationship = await SalaoCliente.findByIdAndUpdate(
      req.params.id,
      { status: 'I' },
      { new: true }
    );

    if (!updatedRelationship) {
      return res.json({ error: true, message: 'Vínculo não encontrado!' });
    }

    res.json({ error: false, message: 'Vínculo desativado com sucesso.' });
  } catch (err) {
    res.json({ error: true, message: err.message });
  }
});

module.exports = router;
