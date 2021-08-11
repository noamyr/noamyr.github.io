window.addEventListener('load', (event) => {

  main();
  function main(){
  var width = window.innerWidth;
  var height = window.innerHeight;
  var textcount;
  var map=new Array(0);
  var animationend=0;
  var loadtime=1;
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
    var cursor=9;
    var mcursor=cursor;
  var textspeed=1000;
  }
  
  var gridWidth = width / segment;
  
  var headerSize, gridlineheight;
  headerSize = (gridWidth * 12) / 7.201238462;
  gridlineheight=57/3 * gridWidth/20;
  var basewidth=(gridWidth/2).toString()+"px ", baseheight=((gridlineheight).toString()+"px ");
  document.getElementById("basegrid").style.gridTemplateColumns=basewidth.repeat(segment*2);
  document.getElementById("basegrid").style.gridTemplateRows=baseheight.repeat(Math.round(height/gridlineheight));
  
  function gridreset(){
    document.getElementById("basegrid").style.gridTemplateColumns=basewidth.repeat(segment*2);
    document.getElementById("basegrid").style.gridTemplateRows=baseheight.repeat(cursor-1);
    mapreset(cursor);
  }
  function mapreset(end){
    for(var i=0; map.length<segment*2*(end) ;i++) map.push(0);
  }
  
  document.getElementById("intro").style.width=(width-gridWidth*2).toString() + "px";
  document.getElementById("intro").style.margin=(gridWidth).toString() + "px";
  
  for (var i = 0; i < document.getElementsByClassName("title").length; i++) {
    document.getElementsByClassName("title")[i].style.fontSize =
    headerSize.toString() + "px";
    document.getElementsByClassName("title")[i].style.lineHeight =
    (gridlineheight*2).toString() + "px";
  }
  function refreshGeneratedFont(){
  for (var i = 0; i < document.getElementsByClassName("generated").length; i++) {
    document.getElementsByClassName("generated")[i].style.fontSize = (headerSize / 2).toString() + "px";
    document.getElementsByClassName("generated")[i].style.lineHeight = (gridlineheight).toString() + "px";
  }}
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
  for(var i = 0; i < document.getElementsByClassName("autoh").length; i++){
    document.getElementsByClassName("autoh")[i].style.height = (Math.round(document.getElementsByClassName("autoh")[i].offsetHeight/gridlineheight)*gridlineheight).toString() + "px";
  }
  
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
        x0=17;
        x1=112;
      }
      else{
      x0=5;
      x1=28;}
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
          }
        }
        if(i%3==1)
        {
          item.style.gridRowStart = (cursorsegment1).toString();
          y0=cursorsegment1-1;
          item.style.gridRowEnd = (cursorsegment1+rowspan).toString();
          y1=cursorsegment1+rowspan+1;
          item.style.gridColumnStart=10;
          x0=9;
          item.style.gridColumnEnd=40;
          x1=40;
          cursorsegment1+=rowspan+4;
          cursor=cursorsegment1+1;
        }
        else if(i%3==2)
        {
          item.style.gridRowStart = (cursorsegment2).toString();
          y0=cursorsegment2-1;
          item.style.gridRowEnd = (cursorsegment2+rowspan).toString();
          y1=cursorsegment2+rowspan+1;
          item.style.gridColumnStart=10+40;
          x0=9+40;
          item.style.gridColumnEnd=40+40;
          x1=40+40;
          cursorsegment2+=rowspan+4;
          cursor=cursorsegment2+1;
        }
        else{
          item.style.gridRowStart = (cursorsegment3).toString();
          y0=cursorsegment3-1;
          item.style.gridRowEnd = (cursorsegment3+rowspan).toString();
          y1=cursorsegment3+rowspan+1;
          item.style.gridColumnStart=10+80;
          x0=9+80;
          item.style.gridColumnEnd=40+80;
          x1=40+80;
          cursorsegment3+=rowspan+4;
          cursor=cursorsegment3+1;
        }}
        else{
          item.style.gridRowStart = (cursor).toString();
          y0=cursor-1;
          item.style.gridRowEnd = (cursor+rowspan).toString();
          y1=cursor+rowspan+1;
        if(i%2==1)
        {
          item.style.gridColumnStart=10;
          x0=9;
          item.style.gridColumnEnd=32;
          x1=33;
        }
        else{
          x0=1;
          x1=25;
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
  setTimeout(() => {markovFill(mcursor);}, loadtime*2);
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
      if (window.innerHeight + window.scrollY >= document.getElementById("basegrid").offsetHeight) {
        cursor+=10;
        gridreset();
        markovFill(cursor-10);
      }
    }
    };
  
  function markovFill(startingpoint){
  var linelast=-999;
  var idstart=idcount;
  for(var i=startingpoint-3;i<map.length/segment;i++){
    for(var j=1;j<=segment*2;j++){
      if(map[i*segment*2+j]==0){
        if(linelast!=-999 && j>linelast+1){
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
      var code=Math.round(Math.random()*1000)%4;
      if(code==0){
        var textnode = document.createTextNode("A");
        node.style.backgroundColor="red";
      }
      else if(code==1){
        var textnode = document.createTextNode("T");
        node.style.backgroundColor="green";
      }
      else if(code==2){
        var textnode = document.createTextNode("G");
        node.style.backgroundColor="pink";
      }
      else{
        var textnode = document.createTextNode("C");
        node.style.backgroundColor="blue";
      }
      node.appendChild(textnode);
      document.getElementById("basegrid").appendChild(node);
      textcount++;
      idcount++;}
      linelast=j;
      }
    }
    linelast=-999;
  }
  document.getElementById(document.getElementsByClassName("generated").length-2).addEventListener('animationend', () => { animationend=1; });
  refreshGeneratedFont();
  }
  }});
