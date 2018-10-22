/* eslint-disable  func-names */
/* eslint-disable  no-console */

const Alexa = require('ask-sdk');
const https = require('https');
const AWS = require('aws-sdk');
const SNS = new AWS.SNS();
const DynamoDB = new AWS.DynamoDB.DocumentClient();
const snsTopic = process.env.SNS_TOPIC;
const dataTable = process.env.DATA_TABLE;
const uuid = require('uuid/v4');
const Lambda = new AWS.Lambda();
const backupFunction = process.env.BACKUP_FUNCTION;

async function startBackupProcess() {
  //   console.log("invokeLambda start: " + functionName + JSON.stringify(payload))
  const lambdaParams = {
    FunctionName: backupFunction,
    InvocationType: 'RequestResponse',
    LogType: 'Tail',
    Payload: JSON.stringify({})
  };
  return Lambda.invoke(lambdaParams).promise()
};

function abbrState(input, to) {
  console.log('input is: ', input)

  var states = [
    ['Arizona', 'AZ'],
    ['Alabama', 'AL'],
    ['Alaska', 'AK'],
    ['Arizona', 'AZ'],
    ['Arkansas', 'AR'],
    ['California', 'CA'],
    ['Colorado', 'CO'],
    ['Connecticut', 'CT'],
    ['Delaware', 'DE'],
    ['Florida', 'FL'],
    ['Georgia', 'GA'],
    ['Hawaii', 'HI'],
    ['Idaho', 'ID'],
    ['Illinois', 'IL'],
    ['Indiana', 'IN'],
    ['Iowa', 'IA'],
    ['Kansas', 'KS'],
    ['Kentucky', 'KY'],
    ['Kentucky', 'KY'],
    ['Louisiana', 'LA'],
    ['Maine', 'ME'],
    ['Maryland', 'MD'],
    ['Massachusetts', 'MA'],
    ['Michigan', 'MI'],
    ['Minnesota', 'MN'],
    ['Mississippi', 'MS'],
    ['Missouri', 'MO'],
    ['Montana', 'MT'],
    ['Nebraska', 'NE'],
    ['Nevada', 'NV'],
    ['New Hampshire', 'NH'],
    ['New Jersey', 'NJ'],
    ['New Mexico', 'NM'],
    ['New York', 'NY'],
    ['North Carolina', 'NC'],
    ['North Dakota', 'ND'],
    ['Ohio', 'OH'],
    ['Oklahoma', 'OK'],
    ['Oregon', 'OR'],
    ['Pennsylvania', 'PA'],
    ['Rhode Island', 'RI'],
    ['South Carolina', 'SC'],
    ['South Dakota', 'SD'],
    ['Tennessee', 'TN'],
    ['Texas', 'TX'],
    ['Utah', 'UT'],
    ['Vermont', 'VT'],
    ['Virginia', 'VA'],
    ['Washington', 'WA'],
    ['West Virginia', 'WV'],
    ['Wisconsin', 'WI'],
    ['Wyoming', 'WY'],
  ];

  if (to == 'abbr') {
    input = input.replace(/\w\S*/g, function (txt) { return txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase(); });
    for (i = 0; i < states.length; i++) {
      if (states[i][0] == input) {
        return (states[i][1]);
      }
    }
  } else if (to == 'name') {
    input = input.toUpperCase();
    for (i = 0; i < states.length; i++) {
      if (states[i][1] == input) {
        return (states[i][0]);
      }
    }
  }
}

function getWeather(region, callback) {
  const options = {
    hostname: 'api.weather.gov',
    path: '/alerts/active/area/' + region,
    headers: { 'User-Agent': 'Mozilla/5.0' }
  };
  return httpGet(options);
}

function httpGet(options) {
  return new Promise(((resolve, reject) => {
    const request = https.get(options, (response) => {
      response.setEncoding('utf8');
      let returnData = '';

      if (response.statusCode < 200 || response.statusCode >= 300) {
        return reject(new Error(`${response.statusCode}: ${response.req.getHeader('host')} ${response.req.path}`));
      }

      response.on('data', (chunk) => {
        returnData += chunk;
      });

      response.on('end', () => {
        resolve(JSON.parse(returnData));
      });

      response.on('error', (error) => {
        reject(error);
      });
    });
    request.end();
  }));
}

async function checkWeather(state, override) {
  let region = abbrState(state, 'abbr');

  let weatherData = await getWeather(region);
  console.log(JSON.stringify(weatherData, null, 2));
  if (weatherData === "error") {
    throw new Error('There was an error contacting the weather service a. p. i.')
  }

  if (weatherData.features.length == 0 && !override) {
    console.log("There are no weather alerts for " + state);
    return;
  }
  // There is no data, mock a response
  if (override) {
    weatherData.features = [{
      properties: {
        id: uuid(),
        severity: 'Critical',
        certainty: '100%',
        headline: '9.9 Richter scale earthquake imminent'
      }
    }]
  }

  weatherData.features = weatherData.features.filter(i => !(i.properties.severity === 'Minor'))

  return Promise.all(weatherData.features.map(async item => {
    let responseText = "";
    let id = item.properties.id;
    console.log('id is: ', id)
    let feature = item.properties;
    responseText += " The severity is: " + feature.severity + ".";
    responseText += " The certainty is: " + feature.certainty + ".";
    responseText += " The headline is: " + feature.headline + ".";
    console.log(responseText);
    let dbResult = await DynamoDB.get({
      TableName: dataTable,
      Key: {
        id
      }
    }).promise()

    console.log('item is: ', JSON.stringify(dbResult, null, 2))

    if (!dbResult.Item) {
      console.log('creating record in table...')
      await DynamoDB.put({
        TableName: dataTable,
        Item: {
          id
        }
      }).promise()

      console.log('publishing to topic')
      
      await startBackupProcess()

      await SNS.publish({
        Message: "We have detected bad weather in your region. Your data has automatically been backed up.",
        Subject: "Umbrella Service",
        TopicArn: snsTopic
      }).promise()
    }

    return
  }))
};


exports.handler = async function(event, context, callback) {
  let override;
  if (event.error) {
    override = true
  }

  try {
    let response = await checkWeather('Oregon', override)
    callback(null, response)
  } catch(e) {
    console.error(e)
    callback(e)
  }
}
