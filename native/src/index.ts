
class Native {
    /**
     * Create native by namespace
     * @param namespace namespace
     */
    constructor(namespace: string) {
        this.namespace = namespace
    }
    /**
     * 
     * @param message message object
     */
    send = (message: any) => {
        const wind = window as any
        const m: { [key: string]: any } = {}
        m[this.namespace] = message
        try {
            const s = JSON.stringify(m)
            try {
                // android
                wind.webviewbridge.postMessage(s)
                return
            } catch (_) {

            }
            try {
                // ios
                wind.webviewbridge.postMessage(s)
                return
            } catch (_) {

            }
            // other
            this.messages.push(m)
            this.openUrl(`https://webviewbridge?action=query&namespace=${encodeURIComponent(this.namespace)}"`)
        } catch (error) {
            console.error(`[Bridge][Native] send fail: ${error}`)
        }
    }

    /**
     * Query messages by native
     * @returns serialized message list
     */
    query = () => {
        const v = JSON.stringify(this.messages)
        this.messages.splice(0, this.messages.length)
        return v
    }
    /**
     * Tell native to load or query
     * @param url url
     */
    private openUrl = (url: string) => {
        const iframe = document.createElement('iframe')
        iframe.style.display = 'none'
        iframe.src = url
        document.documentElement.appendChild(iframe)
        setTimeout(() => {
            document.documentElement.removeChild(iframe)
        }, 1)
    }
    private namespace: string
    private messages: any[] = []
}

class Nod {
    // id
    id: string
    // info
    info: any
    // belong to
    wind: Window

    constructor(id: string, info: any, wind: Window) {
        this.id = id
        this.info = info
        this.wind = wind
    }

    obj(): { [key: string]: string } {
        const v: { [key: string]: string } = {}
        v['id'] = this.id
        v['info'] = this.info
        v['href'] = this.wind.location.href
        return v
    }

    equalTo(nod: Nod): boolean {
        return this.id == nod.id && this.wind == nod.wind
    }

    send(message: any) {
        this.wind.postMessage(JSON.stringify(message), "*")
    }

}

class Bridge {
    /**
     * 
     * @param namespace namespace
     */
    constructor(namespace: string) {
        this.namespace = namespace
        this.native = new Native(namespace)
        this.nods = new Map<string, Nod>()
        this.load()
    }
    /**
     * query messages when no native handle work.
     * @returns json string of message array.
     */
    query(): string {
        return this.native.query()
    }
    /**
     *  send message
     * @param str json string of message 
     */
    send(str: string) {
        try {
            const message = JSON.parse(str)
            const { to } = message[this.namespace]
            let n = this.nods.get(to)
            if (n == undefined) {
                throw `[Bridge][Transmit] nod {"id":"${to}"} is not found`
            }
            n.send(message)
        } catch (error) {
            console.error(error)
        }

    }

    private receive = (ev: any) => {
        try {
            const { source, data } = ev
            const message = JSON.parse(data)[this.namespace]
            const { typ, from, to, body } = message
            if (process.env.NODE_ENV === "development") {
                console.log(`[Bridge][Message] ${data}`)
            }
            if (to !== undefined || from === undefined) {
                return
            }
            if (typ === "transmit") {
                let o = this.nods.get(from)
                if (o == undefined) {
                    return
                }
                if (source != o?.wind) {
                    throw `[Bridge][Transmit] window does not match for nod {"id":"${from}"}`
                }
                this.native.send(message)
                return
            }
            if (typ === "connect") {
                const { info } = body
                let o = this.nods.get(from)
                let n = new Nod(from, info, source)
                if (o != undefined) {
                    throw `[Bridge][Connect] duplicated, old nod ${JSON.stringify(o.obj)}, new nod ${JSON.stringify(n.obj)}`
                }
                this.nods.set(from, n)
                this.native.send(message)
                return
            }
            if (typ === "disconnect") {
                const { info } = body
                const o = this.nods.get(from)
                const n = new Nod(from, info, source)
                if (o == undefined) {
                    return
                }
                if (!o.equalTo(n)) {
                    throw `[Bridge][Disconnect] unmatched, old nod ${JSON.stringify(o.obj)}, new nod ${JSON.stringify(n.obj)}`
                }
                this.nods.delete(from)
                this.native.send(message)
                return
            }
        } catch (_) {
        }
    }


    private load() {
        addEventListener("message", this.receive)
        addEventListener("unload", this.unload)
        // broadcast
        const m: { [key: string]: any } = {}
        m[this.namespace] = { typ: "load" }
        const broadcast = (wind: Window, message: string) => {
            wind.postMessage(message, "*")
            const f = wind.frames
            for (let i = 0, l = f.length; i < l; i++) {
                broadcast(f[i], message)
            }
        }
        broadcast(window, JSON.stringify(m))
    }

    private unload() {
        removeEventListener("message", this.receive)
        removeEventListener("unload", this.unload)
        /// disconnect all nods
        this.nods.forEach(nod => {
            const m = { typ: "disconnect", from: nod.id, body: { info: nod.info } }
            this.native.send(m)
        })
        this.nods.clear()
    }

    private namespace: string
    private native: Native
    private nods: Map<String, Nod>
}
;
const namespace = "<namespace>"
const wind = window as any
const key = `webviewbridge/${namespace}`
if (wind[key] == undefined) {
    wind[key] = new Bridge(namespace)
}