import { NPC, Cancelable, Handle, Notify, Message } from "@neutronstarer/npc"
export {Cancelable, Handle, Notify}
export class Bridge {
    /**
     * 
     * @param ns namespace
     * @param name bridge name
     */
    constructor(ns: string, name?: string) {
        this.ns = ns
        this.name = name
        this.npc = new NPC()
        this.id = this.genUuid()
        this.load()
    }
    /**
     * listen handle for method
     * @param method method
     * @param handle handle
     */
    on(method: string, handle: Handle | null) {
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

    private receive(ev: any): any {
        try {
            const wind = ev.source as Window
            if (wind != top) {
                return
            }
            const message = JSON.parse(ev.data)
            const transmit = message[`${this.ns}/${this.id}/transmit`]
            if (transmit != undefined) {
                const m = new Message(transmit["typ"], transmit["id"], transmit["method"], transmit["param"], transmit["error"])
                this.npc.receive(m)
                return
            }
            const connect = message[`${this.ns}/${this.id}/connect`]
            if (connect != undefined) {
                // did connect
                if (this.connected) {
                    return
                }
                this.connected = true
                this.npc.connect((message) => {
                    const m = new Map()
                    m.set(`${this.ns}/transmit`, message)
                    m.set("from", this.id)
                    top?.postMessage(JSON.stringify(m), "*")
                })
                this.whenConnectSuccess.forEach(element => {
                    element()
                })
                this.whenConnectSuccess.splice(0, this.whenConnectSuccess.length)
                this.whenConnectFail.splice(0, this.whenConnectFail.length)
                return
            }
            const load = message[`${this.ns}/load`]
            if (load != undefined) {
                this.connect()
                return
            }
        } catch (error) {
            console.log(error)
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
        this.openUrl(`https://webviewbridge?action=load&ns=${encodeURIComponent(this.ns)}`)
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
        const m = new Map()
        m.set(`${this.ns}/connect`, {name: this.name})
        m.set("from", this.id)
        top?.postMessage(JSON.stringify(m), "*")
    }

    private disconnect() {
        if (this.connected == false) {
            return
        }
        this.connected = false
        this.npc.disconnect()
        const m = new Map()
        m.set(`${this.ns}/disconnect`, {name: this.name})
        m.set("from", this.id)
        top?.postMessage(JSON.stringify(m), "*")
        this.whenConnectFail.forEach(element => {
            element("disconnected")
        })
        this.whenConnectSuccess.splice(0, this.whenConnectSuccess.length)
        this.whenConnectFail.splice(0, this.whenConnectFail.length)
    }

    private wait(): Promise<void> {
        if (this.connected) {
            return new Promise<void>((resolve) => { resolve() })
        }
        return new Promise<void>((resolve, reject) => {
            this.whenConnectSuccess.push(resolve)
            this.whenConnectFail.push(reject)
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
    private connected = false
    private loaded = false
    private whenConnectSuccess = new Array<() => void>()
    private whenConnectFail = new Array<(error: any) => void>()
    private ns: string
    private name?: string
    private id: string
}