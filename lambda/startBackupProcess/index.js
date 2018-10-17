const AWS = require('aws-sdk')
const S3 = new AWS.S3()
const backupBucket = process.env.BACKUP_BUCKET
const dataBucket = process.env.DATA_BUCKET
const storage = require('azure-storage');
const blobService = storage.createBlobService();

const uploadString = async (containerName, blobName, text) => {
  return new Promise((resolve, reject) => {
    blobService.createBlockBlobFromText(containerName, blobName, text, err => {
      if (err) {
        reject(err);
      } else {
        resolve({ message: `Text "${text}" is written to blob storage` });
      }
    });
  });
};

exports.handler = async function(event, context, callback) {
  try {
    console.log('data bucket is:' , dataBucket)
    console.log('backup bucket is: ', backupBucket)

    let objects = await S3.listObjects({
      Bucket: dataBucket
    }).promise()

    const folderContentInfo = objects.Contents;

    let folderName = 'umbrella-' + Date.now();
    await Promise.all(
      folderContentInfo.map(async (fileInfo) => {
        await S3.copyObject({
          Bucket: backupBucket,
          CopySource: `${dataBucket}/${fileInfo.Key}`,  // old file Key
          Key: `${folderName}/${fileInfo.Key}`, // new file Key
        }).promise();
      })
    );
    const azureContainerName = 'umbrellabackup'
    // back up bucket to Azure
    await new Promise((resolve, reject) => {
      blobService.createContainerIfNotExists(azureContainerName, { publicAccessLevel: 'blob' }, err => {
        if (err) {
          reject(err);
        } else {
          resolve({ message: `Container '${azureContainerName}' created` });
        }
      });
    });

    await Promise.all(
      folderContentInfo.map(async (fileInfo) => {
        let item = await S3.getObject({
          Bucket: dataBucket,
          Key: fileInfo.Key
        }).promise();

        let body = item.body

        await uploadString(azureContainerName, `${folderName}/${fileInfo.Key}`, body)
      })
    );

    callback(null, true)
  } catch(e) {
    console.error(e)
    callback(e)
  }
}