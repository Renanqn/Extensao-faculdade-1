const mongoose = require('mongoose');

// Substitua com a sua URI do MongoDB Atlas
const URI = 'mongodb+srv://renanqn1999:ckk5fVaUBXu9NTcO@clusterdev.7tufg.mongodb.net/salao-extensao?retryWrites=true&w=majority';

mongoose.connect(URI, { 
  connectTimeoutMS: 30000,
  socketTimeoutMS: 30000
 })
  .then(() => console.log('Banco de dados conectado ao MongoDB Atlas!'))
  .catch(err => console.error('Erro ao conectar ao banco de dados:', err));
