const Sequelize = require('sequelize');
const config = require('../../config');
const Logger = require('../../universal_logger');

class DatabaseAccessObject {
    constructor(hostname, dialect, port, username, password, database) {

        const reconnectOptions = {
            max_retries: 999,
            onRetry: function (count) {
                Logger.error("connection lost, trying to reconnect (" + count + ")");
            }
        };

        this.sequelize = new Sequelize(database, username, password, {
            host: hostname,
            dialect: dialect,
            logging: (msg) => Logger.info(msg + "\n"),
            reconnect: reconnectOptions || true
        });

        this.sequelize.authenticate()
            .then(() => Logger.info("Connection Established Successfully"))
            .catch(() => Logger.error("Database Connection Failed"));
    }
    returnSequelizeInstance() {
        return this.sequelize;
    }
}

const DAOSingleton = new DatabaseAccessObject(config.DATABASE_HOST, config.DATABASE_DIALECT, config.DATABASE_PORT, config.DATABASE_USERNAME, config.DATABASE_PASSWORD, config.DATABASE_NAME);

module.exports = DAOSingleton.returnSequelizeInstance();