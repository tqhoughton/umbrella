/* eslint-disable  func-names */
/* eslint-disable  no-console */

const Alexa = require('ask-sdk');
const https = require('https');
const region = "OR"; // TODO: Set this based on input

function getWeather(region, callback) {
  const options = {
    hostname: 'api.weather.gov',
    path: '/alerts/active/area/' + region,
    headers: { 'User-Agent': 'Mozilla/5.0' }
  };

  // https.get(options, (resp) => {
  //   let data = '';

  //   // A chunk of data has been recieved.
  //   resp.on('data', (chunk) => {
  //     data += chunk;
  //   });

  //   // The whole response has been received. Print out the result.
  //   resp.on('end', () => {
  //     callback(JSON.parse(data));
  //   });

  // }).on("error", (err) => {
  //   callback("error");
  // });
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




const CheckWeatherHandler = {
  canHandle(handlerInput) {
    const request = handlerInput.requestEnvelope.request;
    return request.type === 'LaunchRequest'
      || (request.type === 'IntentRequest'
        && request.intent.name === 'CheckWeatherIntent');
  },
  async handle(handlerInput) {
    var weatherData = await getWeather(region);
    console.log(weatherData);
    let responseText = "";
    if (weatherData !== "error") {
      let feature = weatherData.features[0].properties;
      responseText = "There are " + weatherData.features.length + " weather alerts in the area.";
      responseText += " Here is the first one.";
      responseText += " The severity is: " + feature.severity + ".";
      responseText += " The certainty is: " + feature.certainty + ".";
      responseText += " The headline is: " + feature.headline + ".";

      console.log(responseText);
    }
    else {
      responseText = "There was an error contacting the weather service a. p. i."
    }
    return handlerInput.responseBuilder
      .speak(responseText + " Would you like to backup your data?")
      .withSimpleCard(SKILL_NAME, responseText)
      .getResponse();
    }
};

  const HelpHandler = {
    canHandle(handlerInput) {
      const request = handlerInput.requestEnvelope.request;
      return request.type === 'IntentRequest'
        && request.intent.name === 'AMAZON.HelpIntent';
    },
    handle(handlerInput) {
      return handlerInput.responseBuilder
        .speak(HELP_MESSAGE)
        .reprompt(HELP_REPROMPT)
        .getResponse();
    },
  };

  const ExitHandler = {
    canHandle(handlerInput) {
      const request = handlerInput.requestEnvelope.request;
      return request.type === 'IntentRequest'
        && (request.intent.name === 'AMAZON.CancelIntent'
          || request.intent.name === 'AMAZON.StopIntent');
    },
    handle(handlerInput) {
      return handlerInput.responseBuilder
        .speak(STOP_MESSAGE)
        .getResponse();
    },
  };

  const SessionEndedRequestHandler = {
    canHandle(handlerInput) {
      const request = handlerInput.requestEnvelope.request;
      return request.type === 'SessionEndedRequest';
    },
    handle(handlerInput) {
      console.log(`Session ended with reason: ${handlerInput.requestEnvelope.request.reason}`);

      return handlerInput.responseBuilder.getResponse();
    },
  };

  const ErrorHandler = {
    canHandle() {
      return true;
    },
    handle(handlerInput, error) {
      console.log(`Error handled: ${error.message}`);

      return handlerInput.responseBuilder
        .speak('Sorry, an error occurred.')
        .reprompt('Sorry, an error occurred.')
        .getResponse();
    },
  };

  const SKILL_NAME = 'Umbrella Weather';
  const HELP_MESSAGE = 'You can say check the weather in some state, back up my data, or, you can say exit... What can I help you with?';
  const HELP_REPROMPT = 'What can I help you with?';
  const STOP_MESSAGE = 'Goodbye!';

  const skillBuilder = Alexa.SkillBuilders.standard();

  exports.handler = skillBuilder
    .addRequestHandlers(
      CheckWeatherHandler,
      HelpHandler,
      ExitHandler,
      SessionEndedRequestHandler
    )
    .addErrorHandlers(ErrorHandler)
    .lambda();
