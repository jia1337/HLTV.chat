RegExp.escape= function(s){return s.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&')}
function sel(sel, el)   {return (el || document).querySelector(sel); }
function selAll(sel, el){return (el || document).querySelectorAll(sel); }
function sMsg(m){chrome.runtime.sendMessage(m)}
function hMsg(m){console.log(m)
  switch (m.c) {
    case "r_getSettings":{
      uiSettings = m.d.uiSettings
      setTimeout(myApp.performActions,300)
      break;}
    case "r_getGames":{
      myApp.listGames(m.d)
      break;}
  }
};
chrome.runtime.onMessage.addListener(hMsg);

var uiSettings
var apiUrl = "https://hltv.pro/Api/v4.php"

var myApp = {
  load: function(){
    sMsg({"c": "getSettings"})
    myApp.addCommonCss()
    window.addEventListener("message", myApp.onWinMsg, false);
  },
  insertChatMenu: function(){
    jQuery('a.navforums').after(
      jQuery('<a href="https://www.hltv.org/hltvChat" class="navforums pro-chat" title="Hltv.pro Chat" style="padding:0 14px">Chat<i> </i></a>')
    )
  },
  
  onWinMsg: function(e){
    if(e.data.fromPro == true){
      jQuery("#"+e.data.id).css("height",e.data.h+"px").css("display","block")
    }
    if(e.data.fromProChat == true){
      var l = sel(".topLoginBar .topBarFloatingUserSettings a")
      if(l){
        jQuery.get(l.href, function(data) {
            pg = jQuery(jQuery.parseHTML(data.trim()));
            var f = pg.find(".profileText span:contains('Country:')").next().find("img")[0].src
            f = f.replace("http://static.hltv.org//images/flag/","").replace(".gif","")
            var uid = l.href.replace("http://www.hltv.org/?pageid=14&userid=","")
            var name = sel(".topLoginBar .username").textContent.trim()
            sel("#proChatFrame").contentWindow.postMessage({
              "fromProChat":true, "isLoggedIn":true,
              "f":f, "u":name, "uid":uid
            }, '*')
        })
      }else{
        sel("#proChatFrame").contentWindow.postMessage({"fromProChat":true, "isLoggedIn":false}, '*')
      }
    }
  },
  addCommonCss: function(){
    var node = document.createElement("link")
    node.rel ="stylesheet"
    node.type = "text/css"
    node.href = chrome.runtime.getURL("ui/content.css")
    var heads = document.getElementsByTagName("head");
    if (heads.length > 0) {
      heads[0].appendChild(node); 
    } else {
      document.documentElement.appendChild(node);
    }
  },
  addGmCEvents: function(){
    $("#proOpenGmCenter").on("click", function(){
      $("html").addClass("pro-gc")
      var w = $("html").width() - 500
      $("#proGmContainer").css("width", w + "px")
      myApp.getGames()
    })
    $("#proGoBack").on("click", function(){ $("html").removeClass("pro-gc")  })
    
    $("#proSwitchGame").on("click", myApp.getGames)
    
    $("#proGameInfo").on("click", ".pro-game", function(e){
      var h = $("html").height() - 30
      var ifr = $('<iframe scrolling="no" frameborder="0" allowTransparency="true" allowFullScreen="true" style="border:none; overflow:hidden; width:100%; height:'+h+'px"></iframe>')
      ifr.prop("src", this.href)
      $("#proGameInfo").hide()
      $("#proGamePlayer").html(ifr).show()
      e.preventDefault()
      e.stopPropagation()
      return false
    })
  },
  performActions: function(){
    if(uiSettings.enableChat){
      myApp.insertChatMenu()
      myApp.insertPageChat()
    }

    myApp.addFrames()
  },
  insertPageChat: function(){
    //chrome-extension://apfaeeboljkkfodakomocapcdkihkdga/ui/Chat.html
    if(document.location.href == "https://www.hltv.org/hltvChat"){
      jQuery(".rightCol").remove()
      jQuery(".contentCol .standard-box").html(
        `<div id='proOverlay'>
          <div id='proGmContainer'>
            <div id='proGmCenter'>
              <div id='proGameInfo'>
                <h1>ES CGSo Games</h1>
                <ul class="pro-game-list"></ul>
                <div class="pro-no-games">No Games available ...</div>
              </div>
              <div id='proGamePlayer'></div>
            </div>
            <div id='proGmCBtns'>
              <button id="proSwitchGame">Switch Game</button>
              <button id="proGoBack">Go Back</button>
            </div>
          </div>
         </div>
        ` + 
        "<iframe id='proChatFrame' allowtransparency='true'></iframe>"+
        "<button id='proOpenGmCenter' style='margin:10px 0'>Open HLTV Gamecenter</button>"
        
      )
      var url = chrome.runtime.getURL("ui/chat/Chat.html")
      if(sel(".toggleUserTheme.selected").textContent == "On")
        url += "?nightMode=true"
      jQuery("#proChatFrame")[0].src = url
      jQuery(".contentCol .standard-box").css("display","block").css("padding","0")
      document.title = "Hltv Chat"
      myApp.addGmCEvents()
    }
  },
  addFrames: function(){
    function getRandomInt(){return Math.floor(Math.random() * (99999 - 100)) + 100}
    var props = 'border="0" scrolling="no" allowtransparency="true" style="border:0; width:100%; height:0px; display:none; margin:30px auto;"';
    var url = "https://hltv.pro/frames/"
    
    var b = "b" + getRandomInt()
    var a = "a" + getRandomInt()
    var l = "l" + getRandomInt()
    var r = "r" + getRandomInt()
    var m = "m" + getRandomInt()
    var t = "t" + getRandomInt()

    //Post comment before and after
    jQuery('.forum-ad').append('<iframe id="'+b+'" src="'+url+'b.html?id='+b+'" '+props+'></iframe>')
    if(document.location.href == "https://www.hltv.org/hltvChat"){
      jQuery("#proOpenGmCenter").after('<iframe id="'+a+'" src="'+url+'a.html?id='+a+'" '+props+'></iframe>')
    }
  },
  
  getGames:function(){
    sMsg({"c":"getGames"})
  },
  listGames:function(d){
    var ul, li
    if(d.length){
      ul = $(".pro-game-list").html("")
      $.each(d, function(i,e){
        li = $("<li>")
        li.append($('<a class="pro-game" href="'+ e.url +'">'+ e.name +'</a>') )
        ul.append(li)
      })
      $("#proGameInfo").show()
      $(".pro-no-games").hide("")
    }else{
      $("#proGameInfo").show()
      $(".pro-game-list").html("")
      $(".pro-no-games").show()
    }
    $("#proGamePlayer").html("").hide()
  },
}
jQuery(document).ready(myApp.load)
