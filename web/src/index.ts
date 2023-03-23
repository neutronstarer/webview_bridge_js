import { NPC, Cancelable, Handle, Notify, Message } from "@neutronstarer/npc"
export { Cancelable, Handle, Notify }
export class Bridge {
    /**
     * 
     * @param namespage namespace
     * @param info bridge info
     */
    constructor(namespage: string, info?: {[key: string]: any}) {
        this.namespace = namespage
        this.info = info
        this.npc = new NPC()
        this.id = this.genUuid()
        this.load()
    }
    /**
     * listen handle for method
     * @param method method
     * @param handle handle
     */
    on(method: string, handle: Handle|null) {
        this.npc.on(method, handle)
    }
    /**
     * emit a method without reply
     * @param method method
     * @param param param
     */
    async emit(method: string, param?: unknown) {
        await this.wait()
        this.npc.emit(method, param)
    }
    /**
     * deliver a method with reply
     * @param method method
     * @param param param
     * @param config extra config
     * @returns 
     */
    async deliver<R>(method: string, param?: unknown, config?: {
        timeout?: number,
        cancelable?: Cancelable,
        onNotify?: Notify,
    }): Promise<R> {
        await this.wait()
        return (await this.npc.deliver(method, param, config?.timeout, config?.cancelable, config?.onNotify)) as R
    }

    /**
     * Dispose bridge. Bridge will dispose automatically when window/frame unload. 
     */
    dispose() {
        this.unload()
    }

    private receive = (ev: any) => {
        try {
            const {source, data} = ev
            if (source !== top) {
                return
            }
            const {typ, to, body} = JSON.parse(data)[this.namespace]
            if (typ === "load") {
                // hub did load
                this.connect()
                return
            }
            if (to !== this.id) {
                return
            }
            if (typ == "transmit") {
                // transmit
                const m = new Message(body.typ, body.id, body.method, body.param, body.error)
                this.npc.receive(m)
                return
            }
            if (typ == "connect"){
                  // did connect
                  if (this.connected) {
                    return
                }
                this.connected = true
                this.npc.connect((message) => {
                    const m = {typ: "transmit", from: this.id, body: message}
                    this.send(m)
                })
                this.connectionResult.forEach(element => {
                    element(undefined)
                })
                this.connectionResult.splice(0, this.connectionResult.length)
                return
            }
        } catch (_) {

        }
    }

    private load() {
        if (this.loaded == true) {
            return
        }
        this.loaded = true
        addEventListener("message", this.receive)
        addEventListener("unload", this.unload)
        this.connect()
        // tell native to load hub
        this.openUrl(`https://webviewbridge?action=load&namespace=${encodeURIComponent(this.namespace)}`)
    }

    private unload() {
        if (this.loaded == false) {
            return
        }
        this.loaded = false
        removeEventListener("message", this.receive)
        removeEventListener("unload", this.unload)
        this.disconnect()
    }

    private connect() {
        if (this.connected) {
            return
        }
        const m = {typ: "connect", from: this.id, body: {info: this.info}}
        this.send(m)
    }

    private disconnect() {
        if (this.connected == false) {
            return
        }
        this.connected = false
        this.npc.disconnect()
        const m = {typ: "disconnect", from: this.id, body: {info: this.info}}
        this.send(m)
        this.connectionResult.forEach(element => {
            element("disconnected")
        })
        this.connectionResult.splice(0, this.connectionResult.length)
    }

    private send(m: {[key: string]: any}){
        const message: { [key: string]: any } = {}
        message[this.namespace] = m
        top?.postMessage(JSON.stringify(message), "*")
    }

    private wait(): Promise<void> {
        if (!this.loaded){
            return Promise.reject("disconnected")
        }
        if (this.connected) {
            return Promise.resolve()
        }
        return new Promise<void>((resolve, reject) => {
            this.connectionResult.push((error: any) => {
                if (error === undefined || error === null) {
                    resolve()
                } else {
                    reject(error)
                }
            })
        })
    }

    private genUuid(): string {
        let d = new Date().getTime()
        if (window.performance && typeof window.performance.now === "function") {
            d += performance.now()
        }
        return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, function (c) {
            const r = (d + Math.random() * 16) % 16 | 0
            d = Math.floor(d / 16)
            return (c == "x" ? r : (r & 0x3 | 0x8)).toString(16)
        })
    }

    private openUrl(url: string) {
        const iframe = document.createElement('iframe')
        iframe.style.display = 'none'
        iframe.src = url
        document.documentElement.appendChild(iframe)
        setTimeout(() => {
            document.documentElement.removeChild(iframe)
        }, 1)
    }

    private npc: NPC
    private loaded = false
    private connected = false
    private connectionResult = new Array<(error: any) => void>()
    private namespace: string
    private info?: any
    private id: string
}