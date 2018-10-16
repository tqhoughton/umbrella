const AWS = require('aws-sdk')
const S3 = new AWS.S3()
const backupBucket = process.env.BACKUP_BUCKET
const dataBucket = process.env.DATA_BUCKET

exports.handler = async function(event, context, callback) {
  try {
    console.log('data bucket is:' , dataBucket)
    console.log('backup bucket is: ', backupBucket)

    let objects = await S3.listObjects({
      Bucket: dataBucket
    }).promise()

    const folderContentInfo = objects.Contents;

    await Promise.all(
      folderContentInfo.map(async (fileInfo) => {
        await S3.copyObject({
          Bucket: backupBucket,
          CopySource: `${dataBucket}/${fileInfo.Key}`,  // old file Key
          Key: fileInfo.Key, // new file Key
        }).promise();
      })
    );

    callback(null, true)
  } catch(e) {
    console.error(e)
    callback(e)
  }
}