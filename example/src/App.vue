<template>
  <img alt="Vue logo" src="./assets/logo.png">
  <ol>
    <li>
    <label>{{msg}}</label>
  </li>
  <li >
    <button @click="click">{{buttonTitle}}</button>
  </li>
</ol>

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
        this.buttonTitle = "暂停"
        this.cancelable = new Cancelable()
        try {
          const res = await this.bridge.deliver("download","/path", {cancelable: this.cancelable, onNotify: (param)=>{
          console.log(param)
          this.msg = param
        }})
        this.msg = res
        this.cancelable = undefined
        } catch (e) {
          this.msg = e
          this.cancelable = undefined
        }

      }else{
        this.buttonTitle = "下载"
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
      buttonTitle: "下载",
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
