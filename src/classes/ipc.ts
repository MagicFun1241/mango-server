import {ChildProcessWithoutNullStreams, spawn} from "child_process";

export default class Ipc {
    private process: ChildProcessWithoutNullStreams;

    constructor(options) {

    }

    send(message: any) {

    }

    start() {
        this.process = spawn("node", [

        ], {
            stdio: ['inherit', 'inherit', 'inherit', 'ipc']
        });

        this.process.on("message", data => {
           if (typeof data !== 'string') return;
        });
    }
}
