<template>
  <img alt="Vue logo" src="./assets/logo.png">
  <label>{{msg}}</label>
  <button @click="click">下载</button>
</template>

<script>
import { onMounted, onUnmounted } from 'vue';
import {Bridge, Cancelable} from '@neutronstarer/webview_bridge';

export default {
  name: 'App',
  components: {
  },
  setup(){
    onUnmounted(()=>{
      this.bridge.dispose()
    })
    onMounted(()=>{
    })
  },
  methods:{
    async click(){
      if (this.cancelable == undefined) {
        this.cancelable = new Cancelable()
        const res = await this.bridge.deliver("download","/path", {cancelable: this.cancelable, onNotify: (param)=>{
          console.log(param)
          this.msg = param
        }})
        console.log(res)
        this.msg = res
        this.cancelable = undefined
      }else{
        this.cancelable.cancel()
        this.cancelable = undefined
      }
    }
  },
  data(){
    return {
      bridge: new Bridge("com.neutronstarer.webviewbridge", "homepage"),
      cancelable: undefined,
      msg: "未开始",
    }
  }
}
</script>

<style>
#app {
  font-family: Avenir, Helvetica, Arial, sans-serif;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
  text-align: center;
  color: #2c3e50;
  margin-top: 60px;
}
</style>
