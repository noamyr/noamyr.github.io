  var width = window.innerWidth;
  var height = window.innerHeight;
  var generatedcount = 0, lastwords="";
  var textcount;
  var map=new Array(0);
  var animationend=0;
  var elementgap=4;
  if(width>600){
  var segment = 16*4;
  var cursor=7;
  var cursorsegment1=cursor, cursorsegment2=cursor+2, cursorsegment3=cursor+4;
  var mcursor=cursor;
  var textspeed=2000;
  }
  else{
    var segment=16;
    var cursor=10;
    var mcursor=cursor;
  var textspeed=1000;
  }
  
  var gridWidth = width / segment;
  
  var generatedtext="";
  var headerSize, gridlineheight;
  headerSize = (gridWidth * 12) / 7.201238462;
  gridlineheight=57/3 * gridWidth/20;
  var basewidth=(gridWidth/2).toString()+"px ", baseheight=((gridlineheight).toString()+"px ");
  document.getElementById("basegrid").style.gridTemplateColumns=basewidth.repeat(segment*2);
  document.getElementById("basegrid").style.gridTemplateRows=baseheight.repeat(Math.round(height/gridlineheight));
  
  var markov =[], firstwords =[];

  settextsize();


  window.addEventListener('DOMContentLoaded', (event) => {
  window.addEventListener('load', (event) => {
  if(width<600)setTimeout(() => {fetchText();}, 300);
  else fetchText();
  async function fetchText() {
    let response = await fetch('/somebodyhelp.txt');
    if (response.status === 200) {
        let data = await response.text();
        const words = data.split(" ");
  for (var i=0, j=0, k=0; i<words.length; i++){

      markov[j] = words[i];
      j++;
    if(words[i][0]>='A' && words[i][0]<='Z'){
      if(i==0){
        firstwords[k]= words[i].concat(" ", words[i+1]);
      k++;
      }
      else if(words[i-1][words[i-1].length-1]=='.' || words[i-1][words[i-1].length-1]=='?' || words[i-1][words[i-1].length-1]=='!'){
        firstwords[k]= words[i].concat(" ", words[i+1]);
      k++;
      } 
    }
  }
  main();
  }
}
});});


  function settextsize(){
  document.getElementById("intro").style.width=(width-gridWidth*2).toString() + "px";
  document.getElementById("intro").style.margin=(gridWidth).toString() + "px";
  
  document.getElementById("scroll").style.fontSize = (headerSize / 2).toString() + "px";
  document.getElementById("scroll").style.lineHeight = (gridlineheight).toString() + "px";
  
  for (var i = 0; i < document.getElementsByClassName("title").length; i++) {
    document.getElementsByClassName("title")[i].style.fontSize =
    headerSize.toString() + "px";
    document.getElementsByClassName("title")[i].style.lineHeight =
    (gridlineheight*2).toString() + "px";
  }
  for (var i = 0; i < document.getElementsByClassName("subtitle").length; i++) {
    document.getElementsByClassName("subtitle")[i].style.fontSize = (headerSize / 2).toString() + "px";
    document.getElementsByClassName("subtitle")[i].style.lineHeight = (gridlineheight).toString() + "px";
  }
  for (var i = 0; i < document.getElementsByClassName("body").length; i++) {
    document.getElementsByClassName("body")[i].style.fontSize = (headerSize / 3).toString() + "px";
    document.getElementsByClassName("body")[i].style.lineHeight = (gridlineheight*2/3).toString() + "px";
  }
  for (var i = 0; i < document.getElementsByClassName("caption").length; i++) {
    document.getElementsByClassName("caption")[i].style.fontSize = (headerSize / 4).toString() + "px";
    document.getElementsByClassName("caption")[i].style.lineHeight = (gridlineheight/2).toString() + "px";
  }
  }

  function main(){
    generatedtext+=markovMe(markov,1500);
    function gridreset(){
      document.getElementById("basegrid").style.gridTemplateColumns=basewidth.repeat(segment*2);
      document.getElementById("basegrid").style.gridTemplateRows=baseheight.repeat(cursor-1);
      mapreset(cursor);
    }
    function mapreset(end){
      for(var i=0; map.length<segment*2*(end) ;i++) map.push(0);
    }
    for(var i = 0; i < document.getElementsByClassName("autoh").length; i++){
      document.getElementsByClassName("autoh")[i].style.height = (Math.round(document.getElementsByClassName("autoh")[i].offsetHeight/gridlineheight)*gridlineheight).toString() + "px";
    }
    
    function refreshGeneratedFont(){
      for (var i = 0; i < document.getElementsByClassName("generated").length; i++) {
        document.getElementsByClassName("generated")[i].style.fontSize = (headerSize / 2).toString() + "px";
        document.getElementsByClassName("generated")[i].style.lineHeight = (gridlineheight).toString() + "px";
      }}
    
    organize();    
    function organize(){
    textcount=0;
    idcount=0;
      for (var i = 0; i < textcount; i++) {
        document.getElementById(i.toString()).remove();
      }
      for(var i=0;i<map.length;i++){
        map[i]=0;
      }
      for (var i = 0; i < document.getElementsByClassName("item").length; i++) {
      var item=document.getElementsByClassName("item")[i];
      var elementheight=item.firstChild.offsetHeight;
      var rowspan=Math.round(elementheight/gridlineheight);
      var x0,x1,y0,y1;
      if(item.className[item.className.length-1]=="w"){
      item.style.gridRowStart = (cursor).toString();
      y0=cursor-1;
      item.style.gridRowEnd = (cursor+rowspan).toString();
      y1=cursor+rowspan+1;
        cursor+=rowspan+elementgap;
        if(width>600){
          x0=30;
          x1=95;
        }
        else{
        x0=4;
        x1=27;}
        item.style.gridColumnStart=(x0+2).toString();
        item.style.gridColumnEnd=(x1+1).toString();
      }
      else if(item.className[item.className.length-1]=="n"){
        if(width>600){
          if(i>0)
          {
            var nitem=document.getElementsByClassName("item")[i-1];
            if(nitem.className[nitem.className.length-1]=="w"){
              cursorsegment1=cursor;
              cursorsegment2=cursor+2;
              cursorsegment3=cursor+4;
              var firstnarrow=i-1;
            }
          }
          if((i-firstnarrow)%3==1)
          {
            item.style.gridRowStart = (cursorsegment1).toString();
            y0=cursorsegment1-1;
            item.style.gridRowEnd = (cursorsegment1+rowspan).toString();
            y1=cursorsegment1+rowspan+1;
            item.style.gridColumnStart=10;
            x0=8;
            item.style.gridColumnEnd=40;
            x1=39;
            cursorsegment1+=rowspan+4;
            cursor=cursorsegment1+1;
          }
          else if((i-firstnarrow)%3==2)
          {
            item.style.gridRowStart = (cursorsegment2).toString();
            y0=cursorsegment2-1;
            item.style.gridRowEnd = (cursorsegment2+rowspan).toString();
            y1=cursorsegment2+rowspan+1;
            item.style.gridColumnStart=10+40;
            x0=8+40;
            item.style.gridColumnEnd=40+40;
            x1=39+40;
            cursorsegment2+=rowspan+4;
            cursor=cursorsegment2+1;
          }
          else{
            item.style.gridRowStart = (cursorsegment3).toString();
            y0=cursorsegment3-1;
            item.style.gridRowEnd = (cursorsegment3+rowspan).toString();
            y1=cursorsegment3+rowspan+1;
            item.style.gridColumnStart=10+80;
            x0=8+80;
            item.style.gridColumnEnd=40+80;
            x1=39+80;
            cursorsegment3+=rowspan+4;
            cursor=cursorsegment3+1;
          }
          if(i<document.getElementsByClassName("item").length-1)
          {
            var nitem=document.getElementsByClassName("item")[i+1];
            if(nitem.className[nitem.className.length-1]=="w"){
              cursor=Math.max(cursorsegment1,cursorsegment2,cursorsegment3);
            }
          }
        }
          else{
            item.style.gridRowStart = (cursor).toString();
            y0=cursor-1;
            item.style.gridRowEnd = (cursor+rowspan).toString();
            y1=cursor+rowspan+1;
          if(i%2==1)
          {
            item.style.gridColumnStart=10;
            x0=8;
            item.style.gridColumnEnd=32;
            x1=32;
          }
          else{
            x0=0;
            x1=24;
          }
          cursor+=rowspan+elementgap;
          }
          
      }
      gridreset();
      for(var j=y0;j<y1;j++){
        for(var k=x0;k<x1;k++){
          map[j*segment*2+k]=1;
        }
      }
    }
    document.getElementById("loader").style.display = "none";
  //  markovFill(mcursor);
    setTimeout(() => {markovFill(mcursor);}, 1);
    for(i=0;document.getElementById("basegrid").offsetHeight<height;i++){
      cursor++;
      gridreset();
    }
    }
    
    /*window.addEventListener("resize", () => {
      location.reload();
    });*/
    
    
      window.onscroll = function (ev) {
        if(animationend==1){
        if (window.innerHeight + window.scrollY >= document.getElementById("basegrid").offsetHeight+document.getElementById('scroll').offsetHeight) {
          document.getElementById('scroll').style.top=(document.getElementById("basegrid").offsetHeight).toString() + "px";
          var editedtext=generatedtext.slice(textcount,textcount+textspeed);
          document.getElementById('scroll').innerHTML+=editedtext;
          textcount+=textspeed;
          if(generatedtext.length<textcount+segment*textspeed)generatedtext+=markovMe(markov,textspeed);
        }
      }
        //else window.scrollTo(0,document.getElementById("basegrid").offsetHeight-gridlineheight-height);
      };
      /*if (window.scrollY + height >= document.getElementById("basegrid").offsetHeight) {
        window.scrollTo(0,document.getElementById("basegrid").offsetHeight-gridlineheight);
        document.getElementById(document.getElementsByClassName("generated").length-2).addEventListener('animationend', () => {
        for(i=0;generatedtext.length<textcount+segment*2*20;i++){
          generatedtext+=markovMe(markov,1);
        }
        cursor+=10;
        gridreset();
        markovFill(cursor-mcursor);
        });
      }*/
    
    function markovFill(startingpoint){
    var linelast=-999;
    var idstart=idcount;
    for(var i=startingpoint-3;i<map.length/(segment*2);i++){
      for(var j=1;j<=segment*2;j++){
        if(map[i*segment*2+j-1]==0){
          if(linelast!=-999 && j>linelast+1){
            hyphenate();
          }
          else{
        var node = document.createElement("div");
        node.className = "generated";
        node.id = idcount.toString();
        node.style.gridRowStart = (i).toString();
        node.style.gridRowEnd = (i+1).toString();
        node.style.gridColumnStart = (j).toString();
        node.style.gridcolumnEnd = (j+1).toString();
        if(width>600) node.style.animationDelay = ((idcount-idstart)*0.001).toString()+"s";
        else node.style.animationDelay = ((idcount-idstart)*0.005).toString()+"s";
  //      node.style.backgroundColor="red";
        var textnode = document.createTextNode(generatedtext[textcount]);   
        node.appendChild(textnode);
        document.getElementById("basegrid").appendChild(node);
        textcount++;
        idcount++;
      }
        linelast=j;
        }
      }
      hyphenate();
      linelast=-999;
    }
    document.getElementById(document.getElementsByClassName("generated").length-2).addEventListener('animationend', () => { animationend=1; });
    refreshGeneratedFont();
    }
    
    function markovMe(text, runs) {
      const markovChain = {};
      const textArr = text;
      for (let i = 0; i < textArr.length; i++) {
        let word = textArr[i];
        if (!markovChain[word]) {
          markovChain[word] = [];
        }
        if (textArr[i + 1]) {
          markovChain[word].push(textArr[i + 1]);
        }
      }
      const words = Object.keys(markovChain);
    
      let result="";
    
      if(generatedcount==0){
        lastwords = firstwords[Math.floor(Math.random() * firstwords.length)];
        result+=lastwords + " ";
        generatedcount++;
      }
    
      let word = lastwords;
      for(var i=0; i<runs; i++){
      if (!word || !markovChain.hasOwnProperty(word)) word = words[Math.floor(Math.random() * words.length)];
      else{
      newWord = markovChain[word][Math.floor(Math.random() * markovChain[word].length)];
      word = newWord;}
      
      result+=word + " ";
      lastwords=word;
      generatedcount++;}
      return result;
    }
    
    function hyphenate(){
      if(generatedtext[textcount-3]===' '){
        document.getElementById((idcount-1).toString()).innerHTML = " ";
        document.getElementById((idcount-2).toString()).innerHTML = " ";
        textcount-=2;
      }
      else if(generatedtext[textcount-2]==' '){
        document.getElementById((idcount-1).toString()).innerHTML = " ";
        textcount--;
      }
      else if(generatedtext[textcount-1]==' '){
      }
      else if(generatedtext[textcount]==' '){
        textcount++;
      }
      else if(generatedtext[textcount-1]!="." && generatedtext[textcount-1]!="!" && generatedtext[textcount-1]!="?" && generatedtext[textcount-1]!='"' && generatedtext[textcount-1]!="'" ){
        document.getElementById((idcount-1).toString()).innerHTML = "-";
        textcount--;
      }}
    
    }