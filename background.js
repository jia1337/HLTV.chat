function sMsg(s,m){
  if(s.tab)chrome.tabs.sendMessage(s.tab.id,m);
  else     chrome.runtime.sendMessage(s.id, m);
}
chrome.runtime.onMessage.addListener(onExtMessage);
function onExtMessage(m,s){
  switch (m.c) {
    case "getSettings":{
      sMsg(s, {"c": "r_getSettings", "d":{"uiSettings" : uiSettings }});
      break;}
    case "beforeLoadCss":{
      sMsg(s, {
        "c": "r_beforeLoadCss", 
        "curTheme": uiSettings.curTheme, 
        "hideHotTopics":uiSettings.hideHotTopics
      })
      break;}
    case "saveUISettings":{
      uiSettings = m.d
      myApp.saveUISettings()
      if(uiSettings.enableChat == false){
        if(ortcClient.isSubscribed(ortcChannel))
          myApp.ortcUnSubscribe(ortcChannel)
      }
      if(uiSettings.curTheme !== ""){
        myApp.setHltvMode()
      }
      break;}
    case "openChat":{
      myApp.openChatPage()
      break;}
    case "sendChatMsg":{
      m.d.stamp = (new Date().getTime())
      if(m.d.stamp - lastChatMsg > 1000*60){// over 1 minute from last sent msg
        ortcClient.send(ortcChannel, JSON.stringify(m.d))
        lastChatMsg = m.d.stamp
        curMinCnt = 0
        break
      }
      if(curMinCnt <= 15){
        ortcClient.send(ortcChannel, JSON.stringify(m.d))
        lastChatMsg = m.d.stamp
        curMinCnt++
        break
      }
      sMsg(s,{"c":"msgLimitCrossed"})
      break;}
    case "getChatHistory":{
      if(chatConnected){
        var i, h=[];
        for(i=0; i<250; i++){
          if(chatHistory[i] == undefined){break}
          h.push(chatHistory[i])
        }
        h = h.reverse()
        sMsg(s, {"c": "s_chatHistory", "d":h});
      }else{
        curChatTab = s.tab.id
        myApp.ortcConnect()
      }
      break;}
    case "getGames":{
      myApp.getGames(s)
      break;}
  }
}

var uiSettings = {
  "enableChat"     : true
};

var version = "0.1.5";
var historyStats = {}, 
ortcClient, appKey = "afi9AP", ortcToken = "hltvProToken", ortcChannel = "hltvChat",
chatConnected = false, curChatTab=0, lastSubsribed = 0, chatHistory = [], apiUrl = "https://hltv.pro/Api/v4.php",
curMinCnt = 0, lastChatMsg = 0,
chatPageUrl = "https://www.hltv.org/hltvChat"


myApp = {
  load:function(){
    myApp.initStorage()
    setInterval(myApp.chatInactivityChk, 1000*60)//per minute
  },  
  initStorage: function(){
    var extVersion = localStorage["version"]
    if(extVersion == undefined){
      localStorage["version"]      = version
      localStorage['uiSettings']   = JSON.stringify(uiSettings)
      return
    }
    if(extVersion == version){
      uiSettings  = JSON.parse(localStorage["uiSettings"])
      return
    }
    //upgrading from prev version
    localStorage["version"] = version
    //uiSettings = JSON.parse(localStorage["uiSettings"]) not load old settings, overwrite
    localStorage['uiSettings'] = JSON.stringify(uiSettings)
  },
  saveUISettings: function(){
    localStorage["uiSettings"] = JSON.stringify(uiSettings);
  },  
  openChatPage: function(){
    chrome.tabs.query({"url":chatPageUrl}, function (tabs){console.log(tabs)
      if(tabs.length > 0){
        chrome.tabs.update(tabs[0].id, {"active":true})
      }else{
        chrome.tabs.create({"url" : chatPageUrl})
      }
    })
  },

  //CHAT functions ...
  chatInactivityChk: function(){ if(!chatConnected)return
    var cur = (new Date().getTime())
    if(cur - lastChatMsg > 10800000){//3*60*60 * 1000 = 3 hrs
      if(ortcClient.isSubscribed(ortcChannel))
        myApp.ortcUnSubscribe(ortcChannel)
    }
  },
  
  ortcConnect: function(){
    ortcClient = RealtimeMessaging.createClient()
    //ortcClient.setId('clientId');
    //ortcClient.setConnectionMetadata('clientConnMeta');
    ortcClient.setClusterUrl('https://ortc-developers.realtime.co/server/ssl/2.1/')
     
    ortcClient.onConnected = myApp.onOrtcConnected
    ortcClient.onException = myApp.onOrtcException
    ortcClient.onUnsubscribed = function(){
      myApp.ortcDisconnect()
    }
    ortcClient.connect(appKey, ortcToken)
  },
  ortcDisconnect: function(){
    chatConnected = false
    // close Chat tabs
    chrome.tabs.query({"url":chatPageUrl}, function (tabs){
      for(var i=0; i<tabs.length; i++){
        chrome.tabs.remove(tabs[i].id)
      }
    })
    ortcClient.disconnect()    
  },
  onOrtcConnected: function(client, event){
     console.log("Connected to " + ortcClient.getUrl() + " using " + ortcClient.getProtocol())
     myApp.getChatServer()
  },
  onOrtcException: function(client, event){
     console.log("Error: " + event );
  },  
  ortcSubscribe: function(){
    console.log("Subscribing: ", ortcChannel )
    ortcClient.subscribe(ortcChannel, true, myApp.onOrtcMessage)
    lastSubsribed = (new Date().getTime())
    if(curChatTab){
      chatConnected = true
      lastChatMsg = (new Date().getTime())
      onExtMessage({"c":"getChatHistory"},{"tab":{"id":curChatTab}})
    }
  },
  ortcUnSubscribe: function(){
    console.log("UnSubscribing: ", ortcChannel )
    ortcClient.unsubscribe(ortcChannel)
    myApp.ortcDisconnect()
  },
  onOrtcMessage: function(ortc, channel, msg){//console.log('msg received:- ', msg)
    msg = JSON.parse(msg)//"f":"ca", "u":"SOHANCHOTIA", "uid":612481, "m":"sending ..."
    chatHistory.unshift(msg)
    chrome.tabs.query({"url":chatPageUrl}, function (tabs){
      for(var i=0; i<tabs.length; i++){
        chrome.tabs.sendMessage(tabs[i].id, {"c":"s_chatMsg","d":msg})
      }
    })
  },
  
  getChatServer: function(){//lg("getting Stats ...");
    var random = (new Date()).getTime()
    var xhr = new XMLHttpRequest
    var authUrl = apiUrl + "?cmd=getChatHistory&t=" + random
    
    xhr.open("GET", authUrl, true);
    xhr.setRequestHeader('Content-type', 'application/x-www-form-urlencoded');
    
    xhr.onreadystatechange = function(){if(xhr.readyState != 4) return;
      try{
        var j = JSON.parse(xhr.responseText);
        if(j.history.length){
           chatHistory = j.history
           myApp.ortcSubscribe()
        }
      }catch(e){}
    }
    xhr.send();
  },
  
  //<iframe src="https://www.facebook.com/plugins/video.php?href=https%3A%2F%2Fwww.facebook.com%2FESLOneCSGO%2Fvideos%2F1889768841066309%2F&show_text=0&width=560" width="560" height="315" style="border:none;overflow:hidden" scrolling="no" frameborder="0" allowTransparency="true" allowFullScreen="true"></iframe>  
  getGames: function(sender){
    var _s = sender
    var random = (new Date()).getTime()
    var xhr = new XMLHttpRequest
    var authUrl = "https://hltv.pro/Api/games.json?r=" + random
    xhr.open("GET", authUrl, true);
    xhr.onreadystatechange = function(){if(xhr.readyState != 4) return;
      try{
        var j = JSON.parse(xhr.responseText);
        sMsg(_s, {"c":"r_getGames", "d": j})
      }catch(e){}
    }
    xhr.send();
  }
};

chrome.browserAction.onClicked.addListener(function(tab){
  myApp.openChatPage()
})

myApp.load()

chrome.webRequest.onHeadersReceived.addListener(function(details){
    for (var i = 0; i < details.responseHeaders.length; i++) {
      if ('content-security-policy' === details.responseHeaders[i].name.toLowerCase()) {
        details.responseHeaders[i].value = '';
      }
    }
    return {
      responseHeaders: details.responseHeaders
    }
  },
  {//filter
    urls: ["https://www.hltv.org/*"],
    types: ["main_frame", "sub_frame"]
  }, 
  ["blocking", "responseHeaders"]
)