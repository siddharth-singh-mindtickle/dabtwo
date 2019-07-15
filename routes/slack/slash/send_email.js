"use strict";
let AWS = require('aws-sdk');
// // Set the region
AWS.config.update({region: 'us-east-1'});

function sendEmail(email) {
    // Create sendEmail params
    console.log(email);
    let params = {
        Destination: { /* required */
            ToAddresses: [
                email.receiver,
                /* more items */
            ]
        },
        Message: { /* required */
            Body: { /* required */
                Html: {
                    Charset: "UTF-8",
                    Data: email.body
                }
            },
            Subject: {
                Charset: 'UTF-8',
                Data: email.subject
            }
        },
        Source: 'helpdesk@mindtickle.com', /* required */
    };

    // Create the promise and SES service object
    let sendPromise = new AWS.SES({apiVersion: '2010-12-01'}).sendEmail(params).promise();

    // Handle promise's fulfilled/rejected states
    sendPromise.then(
        function(data) {
            console.log(data.MessageId);
        }).catch(
        function(err) {
            console.error(err, err.stack);
        });
}
module.exports = {sendEmail}