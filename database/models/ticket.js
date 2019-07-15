const Sequelize = require(`sequelize`);
const dao = require(`./database_access_object`);
const {WebClient} = require(`@slack/web-api`);
const Logger = require(`../../universal_logger`);
const config = require(`../../config`);
class Ticket extends Sequelize.Model{}

Ticket.init({
    channel: {
        type: Sequelize.STRING(20),
        allowNull: false
    },
    department: {
        // Split it by delimiter and you'd get the second last element containing the email
        type: Sequelize.STRING(3000),
        defaultValue: ""
    },
    subject: {
        type: Sequelize.STRING(1000),
        defaultValue: ""
    },
    details: {
        type: Sequelize.STRING(8000),
        defaultValue: ""
    },
    state:{
        type: Sequelize.BIGINT,
        defaultValue: 0,

    }
}, {
    sequelize: dao,
    modelName: "tickets"
});

Ticket.addHook('beforeDestroy', (ticket, options)=> {
    Logger.info(`Destroying Ticket ID : ${ticket.id}`);
    //Change this everytime you change FSA
    if(parseInt(ticket.getDataValue("state")) !== parseInt("4")){
        const client = new WebClient(config.BOT_USER_TOKEN);
        client.chat.postMessage({
            channel: ticket.channel,
            text: "Looks like you don't wanna talk to me, huh! FINE :unamused:",
            as_user: true
        }).catch(Logger.error);
    }
});

module.exports = Ticket;