const express = require('express');
const router = express.Router();
const Salao = require('../models/salao');
const Servico = require('../models/servico');
const Horario = require('../models/horario');
const turf = require('turf');
const util = require('../util');

// Rota para criar um novo salão
router.post('/', async (req, res) => {
  try {
    const salao = await new Salao(req.body).save();
    res.json({ error: false, salao });
  } catch (err) {
    res.json({ error: true, message: err.message });
  }
});

// Rota para buscar serviços de um salão
router.get('/servicos/:salaoId', async (req, res) => {
  try {
    const { salaoId } = req.params;
    const servicos = await Servico.find({
      salaoId,
      status: 'A', // Apenas serviços ativos
    }).select('_id titulo');

    res.json({
      error: false,
      servicos: servicos.map((s) => ({ label: s.titulo, value: s._id })),
    });
  } catch (err) {
    res.json({ error: true, message: err.message });
  }
});

// Rota para filtrar e obter informações de um salão (como distância e horários)
router.post('/filter/:id', async (req, res) => {
  try {
    const salao = await Salao.findById(req.params.id).select(req.body.fields);
    const { coordinates } = salao.geo || {};

    if (!coordinates || coordinates.length !== 2) {
      return res.json({ error: true, message: 'Localização inválida do salão.' });
    }

    // Calcula a distância entre o salão e uma localização de referência
    const distance = turf
      .distance(
        turf.point(coordinates),
        turf.point([-30.043858, -51.103487]) // Exemplo de coordenadas de referência
      )
      .toFixed(2);

    // Obtém os horários do salão
    const horarios = await Horario.find({
      salaoId: req.params.id,
    }).select('dias inicio fim');

    // Verifica se o salão está aberto com base nos horários
    const isOpened = await util.isOpened(horarios);

    res.json({ error: false, salao: { ...salao._doc, distance, isOpened } });
  } catch (err) {
    res.json({ error: true, message: err.message });
  }
});

module.exports = router;

