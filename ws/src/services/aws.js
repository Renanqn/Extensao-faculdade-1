// Importando o cliente S3 da versão 3
const { S3Client, CreateBucketCommand, PutObjectCommand, DeleteObjectCommand } = require('@aws-sdk/client-s3');

module.exports = {
  IAM_USER_KEY: '',
  IAM_USER_SECRET: '',
  BUCKET_NAME: '',
  AWS_REGION: '',

  // Função de upload para o S3
  uploadToS3: function (file, filename, acl = 'public-read') {
    return new Promise((resolve, reject) => {
      let IAM_USER_KEY = this.IAM_USER_KEY;
      let IAM_USER_SECRET = this.IAM_USER_SECRET;
      let BUCKET_NAME = this.BUCKET_NAME;

      // Criando a instância do cliente S3
      const s3Client = new S3Client({
        region: this.AWS_REGION,
        credentials: {
          accessKeyId: IAM_USER_KEY,
          secretAccessKey: IAM_USER_SECRET,
        },
      });

      // Parâmetros para o upload
      const params = {
        Bucket: BUCKET_NAME,
        Key: filename,
        Body: file.data,
        ACL: acl,
      };

      // Criando o comando PutObjectCommand para o upload
      const command = new PutObjectCommand(params);

      // Realizando o upload
      s3Client.send(command)
        .then(data => {
          console.log(data);
          return resolve({ error: false, message: data });
        })
        .catch(err => {
          console.log(err);
          return resolve({ error: true, message: err });
        });
    });
  },

  // Função para excluir um arquivo do S3
  deleteFileS3: function (key) {
    return new Promise((resolve, reject) => {
      let IAM_USER_KEY = this.IAM_USER_KEY;
      let IAM_USER_SECRET = this.IAM_USER_SECRET;
      let BUCKET_NAME = this.BUCKET_NAME;

      // Criando a instância do cliente S3
      const s3Client = new S3Client({
        region: this.AWS_REGION,
        credentials: {
          accessKeyId: IAM_USER_KEY,
          secretAccessKey: IAM_USER_SECRET,
        },
      });

      // Parâmetros para deletar o objeto
      const params = {
        Bucket: BUCKET_NAME,
        Key: key,
      };

      // Criando o comando DeleteObjectCommand
      const command = new DeleteObjectCommand(params);

      // Realizando a exclusão
      s3Client.send(command)
        .then(data => {
          console.log(data);
          return resolve({ error: false, message: data });
        })
        .catch(err => {
          console.log(err);
          return resolve({ error: true, message: err });
        });
    });
  },
};