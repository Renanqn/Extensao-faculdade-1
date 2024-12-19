const express = require('express');
const app = express();
const morgan = require('morgan');
const multer = require('multer');
const cors = require('cors');

// DATABASE
require('./database');

// Configuração do Multer
const storage = multer.memoryStorage();  // Armazenamento em memória
const upload = multer({ storage: storage }).any();  // Permite enviar qualquer número de arquivos

// Middleware global para processar o Multer
app.use(upload);  // Usa o Multer para processar arquivos em todas as requisições POST ou PUT

app.use(morgan('dev'));
app.use(express.json());
app.use(cors());

// Resto da configuração e rotas do Express
app.set('port', 8000);

// ROTAS
app.use('/salao', require('./src/routes/salao.routes'));
app.use('/cliente', require('./src/routes/cliente.routes'));
app.use('/servico', require('./src/routes/servico.routes'));
app.use('/colaborador', require('./src/routes/colaborador.routes'));
app.use('/horario', require('./src/routes/horario.routes'));
app.use('/agendamento', require('./src/routes/agendamento.routes'));

app.listen(app.get('port'), function () {
  console.log('WS escutando porta ' + app.get('port'));
});
