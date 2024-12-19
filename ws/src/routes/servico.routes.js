const express = require('express');
const router = express.Router();
const multer = require('multer'); // Importando o Multer
const aws = require('../services/aws');
const Servico = require('../models/servico');
const Arquivos = require('../models/arquivos');
const moment = require('moment');

// Configuração do Multer
const storage = multer.memoryStorage();  // Armazena os arquivos em memória
const upload = multer({ storage, limits: { fileSize: 10 * 1024 * 1024 } }); // Limita o tamanho do arquivo para 10MB

// Função reutilizável para upload de arquivos para o S3
const uploadFiles = async (files, salaoId) => {
  let errors = [];
  let arquivos = [];

  if (files && files.length > 0) {
    for (let file of files) {
      // Validação de tipo de arquivo
      if (file.mimetype !== 'image/jpeg' && file.mimetype !== 'image/png') {
        errors.push({ error: true, message: `Tipo de arquivo não permitido: ${file.mimetype}. Apenas imagens JPG e PNG são aceitas.` });
        continue;
      }

      const nameParts = file.originalname.split('.');
      const fileName = `${new Date().getTime()}.${nameParts[nameParts.length - 1]}`;
      const path = `servicos/${salaoId}/${fileName}`;

      const response = await aws.uploadToS3(file.buffer, path);

      if (response.error) {
        errors.push({ error: true, message: response.message.message });
      } else {
        arquivos.push(path);
      }
    }
  }

  return { errors, arquivos };
};

// Rota para criar um novo serviço
router.post('/', upload.array('files'), async (req, res) => {
  console.log(req.files);  // Verifique o que está sendo enviado
  if (!req.files || req.files.length === 0) {
    return res.json({ error: true, message: 'Nenhum arquivo enviado.' });
  }

  try {
    // Processar os arquivos
    const { errors, arquivos } = await uploadFiles(req.files, req.body.salaoId);

    if (errors.length > 0) {
      return res.json(errors[0]);
    }

    // Criar serviço
    const jsonServico = JSON.parse(req.body.servico);
    jsonServico.salaoId = req.body.salaoId;
    const servico = await new Servico(jsonServico).save();

    // Inserir arquivos no banco de dados
    const arquivosToInsert = arquivos.map((arquivo) => ({
      referenciaId: servico._id,
      model: 'Servico',
      arquivo,
    }));
    await Arquivos.insertMany(arquivosToInsert);

    res.json({ error: false, arquivos });
  } catch (err) {
    res.json({ error: true, message: err.message });
  }
});

// Rota para atualizar um serviço
router.put('/:id', upload.array('files'), async (req, res) => {
  try {
    // Processar os arquivos
    const { errors, arquivos } = await uploadFiles(req.files, req.body.salaoId);

    if (errors.length > 0) {
      return res.json(errors[0]);
    }

    // Atualizar serviço
    const jsonServico = JSON.parse(req.body.servico);
    await Servico.findByIdAndUpdate(req.params.id, jsonServico);

    // Inserir arquivos no banco de dados
    const arquivosToInsert = arquivos.map((arquivo) => ({
      referenciaId: req.params.id,
      model: 'Servico',
      arquivo,
    }));
    await Arquivos.insertMany(arquivosToInsert);

    res.json({ error: false });
  } catch (err) {
    res.json({ error: true, message: err.message });
  }
});

module.exports = router;

