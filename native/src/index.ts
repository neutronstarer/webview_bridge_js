
class Native {
  /**
   * 
   * @param ns namespace
   */
  constructor(ns: string){
      this.ns = ns
      this.send = (() => {
        let key = `webviewbridge/messagehandler/${this.ns}`
          const wind = window as any
          try {
              // iOS
              if (wind[key].postMessage != undefined) {
                  return (message: any) => {
                      try {
                          wind[key].postMessage(JSON.stringify(message))
                          return true
                      } catch (error) {
                          console.error(`[Bridge][Native] send fail: ${error}`)
                          return false
                      }
                  }
              }else{
                  throw `[Bridge][Native] not found iOS handler`
              }
          } catch (error) {
              try {
                  // Android
                  if (wind["webkit"].messageHandlers[key].postMessage != undefined) {
                      return (message: any) => {
                          try {
                              wind["webkit"].messageHandlers[key].postMessage(JSON.stringify(message))
                              return true
                          } catch (error) {
                              console.error(`[Bridge][Native] send fail: ${error}`)
                              return false
                          }
                      }
                  } else{
                      throw `[Bridge][Native] not found Android handler`
                  }
              } catch (error) {
                  return (message: any) => {
                      try {
                          this.messages.push(message)
                          this.openUrl(`https://webviewbridge?action=query&ns=${encodeURIComponent(this.ns)}"`)
                          return true
                      } catch (error) {
                          console.error(`[Bridge][Native] send fail: ${error}`)
                          return false
                      }
                  }
              }
          }
      })()
  }
  send: (message: any) => void

  query(): string{
      const v = JSON.stringify(this.messages)
      this.messages.splice(0, this.messages.length)
      return v
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
  private messages = new Array<any>()
  private ns: string 
}

class Nod {
  // id
  id: string
  // name
  name: string
  // belong to
  wind: Window

  constructor(id: string, name: string, wind: Window){
      this.id = id
      this.name = name
      this.wind = wind
  }

  map(): Map<string,string>{
      const v = new Map<string,string>()
      v.set(`id`, this.id)
      v.set(`name`, this.name)
      v.set(`href`, this.wind.location.href)    
      return v
  }

  equalTo(nod: Nod): boolean {
      return this.id == nod.id && this.name == nod.name && this.wind == nod.wind
  }

  send(message: any) {
      this.wind.postMessage(JSON.stringify(message),"*")
  }

}

class Bridge {
  /**
   * 
   * @param ns namespace
   */
  constructor(ns: string) {
      this.ns = ns
      this.native = new Native(ns)
      this.nods = new Map<string,Nod>()
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
          const {to} = message
          let n = this.nods.get(to)
          if (n == undefined){
              throw `[Bridge][Transmit] nod {"id":"${to}"} is not found`
          }
          n.send(message)
      } catch (error) {
          console.error(error)
      }
    
  }

  private receive(ev: any): any {
      try {
          const message = JSON.parse(ev.data)
          const wind = ev.source as Window
          const transmit = message[`${this.ns}/transmit`]
          if (process.env.NODE_ENV === "development") {
            console.log(`[Bridge][Transimit] ${ev.data}`)
          }
          if (transmit != undefined){
              const {from} = message
              let o = this.nods.get(from)
              if (o == undefined){
                  return
              }
              if (wind != o?.wind){
                  throw `[Bridge][Transmit] window does not match for nod {"id":"${from}"}`
              }
              this.native.send(message)
              return
          }
          const connect = message[`${this.ns}/connect`]
          if (connect != undefined) {
              const {from} = message
              const {name} = connect
              let o = this.nods.get(from)
              let n = new Nod(from, name, wind)
              if (o != undefined){
                  throw `[Bridge][Connect] duplicated, old nod ${JSON.stringify(o.map)}, new nod ${JSON.stringify(n.map)}`
              }
              this.nods.set(from, n)
              this.native.send(message)
              return
          }
          const disconnect = message[`${this.ns}/disconnect`]
          if (disconnect != undefined){
              const {from} = message
              const { name} = disconnect
              const o = this.nods.get(from)
              const n = new Nod(from, name, wind)
              if (o == undefined){
                  return
              }
              if (!o.equalTo(n)){
                  throw `[Bridge][Disconnect] unmatched, old nod ${JSON.stringify(o.map)}, new nod ${JSON.stringify(n.map)}`
              }
              this.nods.delete(from)
              this.native.send(message)
              return
          }
      } catch (error) {
          console.error(error)
      }
  }


  private load(){
      addEventListener("message", this.receive)
      addEventListener("unload", this.unload)
      // broadcast
      const m = new Map()
      m.set(`${this.ns}/load`, null)
      const broadcast = (wind: Window, message: string) => {
          wind.postMessage(message, "*")
          const f = wind.frames
          for (let i = 0, l = f.length; i < l; i++) {
              broadcast(f[i], message)
          }
      }
      broadcast(window, JSON.stringify(m))
  }

  private unload(){
      removeEventListener("message", this.receive)
      removeEventListener("unload", this.unload)
      /// disconnect all nods
      this.nods.forEach(nod => {
          const m = new Map()
          m.set(`${this.ns}/disconnect`, {name: nod.name})
          m.set("from", nod.id)
          this.native.send(m)
      })
      this.nods.clear()
  }

  private ns: string
  private native: Native
  private nods: Map<String, Nod>
}
;
const ns = "<ns>"
const wind = window as any
const key = `webviewbridge/${ns}`
if (wind[key] == undefined){
  wind[key] = new Bridge(ns)
}