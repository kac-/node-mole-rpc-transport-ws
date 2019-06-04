const readyState = require('./readyState');
const { sleep, waitForEvent } = require('./utils');

class TransportServerWS {
    constructor({ wsBuilder } = {}, opts = {}) {
        if (!wsBuilder) throw new Error('"wsBuilder" required');
        this.wsBuilder = wsBuilder;
        this.ws = null;
        this.callback = null;
        this._onMessageHandler = null;
        this.opts = opts;
        if(opts.ping) {
            this._timerId = null;
            this._isAlive = true;
            this._onPongHandler = () => {
                this._isAlive = true;
            }
        }
    }

    async onData(callback) {
        this.callback = callback;
        this._run();
    }

    async _run() {
        while (true) {
            try {
                if (!this.ws || this.ws.readyState !== readyState.OPEN) {
                    this.ws = await this._prepareWs();
                }
            } catch (error) {}
            await sleep(1000);
        }
    }

    async _prepareWs() {
        const ws = this.wsBuilder();

        if (ws.readyState === readyState.CONNECTING) {
            await waitForEvent(ws, 'open');
        }

        ws.removeEventListener('message', this._onMessageHandler)

        this._onMessageHandler = async message => {
            const reqData = message.data;
            const resData = await this.callback(reqData);

            if (!resData) return;

            ws.send(resData);
        }

        if(this.opts.ping && ws.ping) {
            ws.removeEventListener('pong', this._onPongHandler)
            clearInterval(this._timerId);
            this._isAlive = true;

            this._timerId = setInterval(() => {
                if (!this._isAlive) {
                    ws.terminate();

                    return clearInterval(this._timerId);
                }

                this._isAlive = false;
                ws.ping();
            }, 15000);

            ws.addEventListener('pong', this._onPongHandler);
        }

        ws.addEventListener('message', this._onMessageHandler);

        return ws;
    }
}

module.exports = TransportServerWS;
