// SVG Navigator
// Authors: Asad Akram, Ryan Oblenida, Peter Ryszkiewicz


// document variables
var svgElements = document.getElementsByTagName("svg");

// check if first svg element exists, and use it
if(svgElements[0] != null){
    // send request to apply svg nav icon to tab, as page action
    chrome.extension.sendRequest({}, function(response){});
    
    var svgDocument = svgElements[0];
    var origViewBox = svgDocument.getAttribute("viewBox");
    // check if the svg document had a viewbox
    if(origViewBox == null){
//        alert("no viewbox");
        var svgWidth = svgDocument.getAttribute("width");
        var svgHeight = svgDocument.getAttribute("height");
        if(svgWidth == null || svgHeight == null){
            // We have a problem
        }
        // make new viewbox and insert it into the svg
        var format =  0.0 + ' ' +
                      0.0 + ' ' +
                      parseFloat(svgWidth) + ' ' +
                      parseFloat(svgHeight);
        
        svgDocument.setAttribute("viewBox", format);
        origViewBox = format;
    }
    var newViewBox = svgDocument.getAttribute("viewBox");
    
    // variables for zooming
    var zoomAction = false;
    var zoomX1 = 0;
    var zoomY1 = 0;
    var zoomX2 = 0;
    var zoomY2 = 0;
    var zoomWidth = 0;
    var zoomHeight = 0;
    
    // variables for panning
    var panStart = true;
    var panAction = false;
    var panViewBoxX = 0;
    var panViewBoxY = 0;
    var panViewBoxWidth = 0;
    var panViewBoxHeight = 0;
    var panOldX = 0;
    var panOldY = 0;
    var panNewX = 0;
    var panNewY = 0;
    var newViewBoxX = 0;
    var newViewBoxY = 0;
    
    // variables for cursor events
    var event;
    
    // variable for refreshing screen
    var refresh = true;
    
    // define svg namespace
    var svgNS = "http://www.w3.org/2000/svg";
    
    // insert a rectangle object into the svg, acting as the zoom rectangle
    var zoomRectangle = document.createElementNS(svgNS, "rect");
    zoomRectangle.setAttributeNS(null, "x", 0);
    zoomRectangle.setAttributeNS(null, "y", 0);
    zoomRectangle.setAttributeNS(null, "rx", 0.01);
    zoomRectangle.setAttributeNS(null, "height", 0);
    zoomRectangle.setAttributeNS(null, "width", 0);
    zoomRectangle.setAttributeNS(null, "opacity", 1);
    zoomRectangle.setAttributeNS(null, "stroke", "blue");
    zoomRectangle.setAttributeNS(null, "stroke-width", 1.0);
    zoomRectangle.setAttributeNS(null, "fill", "blue");
    zoomRectangle.setAttributeNS(null, "fill-opacity", 0.1);
    svgDocument.appendChild(zoomRectangle);
    
    // event listeners
    svgDocument.addEventListener("mousedown", zoomMouseDown, false);
    svgDocument.addEventListener("mousemove", zoomMouseMove, false);
    svgDocument.addEventListener("mouseup", zoomMouseUp, false);
    svgDocument.addEventListener("mousedown", mouseDown, false);
    svgDocument.addEventListener("mousemove", mouseMove, false);
    svgDocument.addEventListener("mouseup", mouseUp, false);
    svgDocument.addEventListener("keydown",panBegin, false);
    svgDocument.addEventListener("mousemove", panMove, false);
    svgDocument.addEventListener("keyup",panEnd, false);
    svgDocument.addEventListener("keyup",zoomOut, false);
    svgDocument.addEventListener("keyup",zoomOriginal, false);
    
    // code to get the texts' original sizes; this is then used to scale later when viewbox changes
    //        svgDocument = document.getElementById(svgID);
    var m = svgDocument.getScreenCTM();
    var p = document.documentElement.createSVGPoint();
    p.y = getHeight();
    
    var q = document.documentElement.createSVGPoint();
    q.y = 0;
    
    p = p.matrixTransform(m.inverse());
    q = q.matrixTransform(m.inverse());
    
    //    origTextScale = (16/screen.height)*(p.y - q.y); // roughly font size 12 at fullscreen
    
    disableSelection();
}

/* Zoom Functions */
// click and drag to zoom in
// press escape to zoom out
function zoomMouseDown(evt) {
	//if the left click is down and the control key is NOT depressed, sets top left of zoombox and flag
    if(zoomRectangle && !evt.ctrlKey) { // zoom
        zoomAction = true;
        var p = document.documentElement.createSVGPoint();
        p.x = evt.clientX;
        p.y = evt.clientY;
        
        var m = zoomRectangle.getScreenCTM();
        p = p.matrixTransform(m.inverse());
        zoomRectangle.setAttribute("x", p.x);
        zoomRectangle.setAttribute("y", p.y);
        zoomX1 = p.x;
        zoomY1 = p.y;
    }
}

// blue zoombox drawn as mouse is moved across screen
function zoomMouseMove(evt) {
    if(zoomAction) {
        var p = document.documentElement.createSVGPoint();
        p.x = evt.clientX;
        p.y = evt.clientY;
        
        var m = zoomRectangle.getScreenCTM();
        p = p.matrixTransform(m.inverse());
        
        zoomX2 = p.x;
        zoomY2 = p.y;
        zoomWidth=Math.abs(zoomX2 - zoomX1)
        zoomHeight=Math.abs(zoomY2 - zoomY1)
        
        // set top left corner point of zoom rectangle
        if(zoomX1 < zoomX2) {
            zoomRectangle.setAttribute("x", zoomX1);
        } else {
            zoomRectangle.setAttribute("x", zoomX2);
        }
        if(zoomY1 < zoomY2){
            zoomRectangle.setAttribute("y", zoomY1);
        } else{
            zoomRectangle.setAttribute("y", zoomY2);
        }
        
        zoomRectangle.setAttribute("width", zoomWidth);
        zoomRectangle.setAttribute("height", zoomHeight);
    }
}

// function that completes zoombox, then zooms view to zoombox
function zoomMouseUp(evt) {
    var h = zoomRectangle.getAttribute("height");
    var w = zoomRectangle.getAttribute("width");
    
	// the viewbox width and height is changed when the button is up
    if(zoomAction){
        if((parseFloat(h)*parseFloat(w))<40){ // prevent zooming on tiny area
            //var format =  origViewBox;
        } else {
            var format =  parseFloat(zoomRectangle.getAttribute("x")) + ' ' +
                          parseFloat(zoomRectangle.getAttribute("y")) + ' ' +
                          parseFloat(w) + ' ' +
                          parseFloat(h);
            
            svgDocument.setAttribute("viewBox", format);
        }
    }
    
    // reset zoom rectangle members
    zoomX1 = 0;
    zoomY1 = 0;
    zoomRectangle.setAttribute("width", 0);
    zoomRectangle.setAttribute("height", 0);
    zoomAction = false;
    
}

// zoom out when user presses alt key
function zoomOut(evt){
    if(evt.type == "keyup"){
        if (evt.charCode) {
            var charCode = evt.charCode;
        } else {
            var charCode = evt.keyCode;
        }
        
        // alt key
        if (charCode == 18) {
            //alert("escape");
            //panStart = true;
            //panAction = true;
            //svgDocument.style.cursor='move';
            
            newViewBox = svgDocument.getAttribute("viewBox");
            
            var tokens = newViewBox;
            var token = tokens.split(" ");
            var viewBoxX = parseFloat(token[0]);
            var viewBoxY = parseFloat(token[1]);
            var viewBoxWidth = parseFloat(token[2]);
            var viewBoxHeight = parseFloat(token[3]);
            
            var newViewBoxX = viewBoxX - 0.1*viewBoxWidth;
            var newViewBoxY = viewBoxY - 0.1*viewBoxHeight;
            var newViewBoxWidth = viewBoxWidth*1.2;
            var newViewBoxHeight = viewBoxHeight*1.2;
            
            var format =  parseFloat(newViewBoxX) + ' ' +
                          parseFloat(newViewBoxY) + ' ' +
                          parseFloat(newViewBoxWidth) + ' ' +
                          parseFloat(newViewBoxHeight);
            
            svgDocument.setAttribute("viewBox", format);
            
            refresh = true;
        }
    }
}


function zoomOriginal(evt){
    if(evt.type == "keyup"){
        if (evt.charCode) {
            var charCode = evt.charCode;
        } else {
            var charCode = evt.keyCode;
        }
        
        // escape key
        if (charCode == 27) {
            var format =  origViewBox;
            svgDocument.setAttribute("viewBox", origViewBox);
			
            refresh = true;
        }
    }
}

function panBegin(evt){
    if(evt.type == "keydown"){
        if (evt.charCode) {
            var charCode = evt.charCode;
        } else {
            var charCode = evt.keyCode;
        }
        
        // spacebar
        if (charCode == 32 && panStart == true) {
            //alert("start");
            panStart = true;
            panAction = true;
            svgDocument.style.cursor='move';
        }
    }
}


function panMove(evt) {
    if(panStart && panAction){
        panAction = true;
        panStart = false;
        var p = document.documentElement.createSVGPoint();
        p.x = evt.clientX;
        p.y = evt.clientY;
        var m = svgDocument.getScreenCTM();
        p = p.matrixTransform(m.inverse());
        
        panOldX = p.x;
        panOldY = p.y;
        
        newViewBox = svgDocument.getAttribute("viewBox");
        
        var tokens = newViewBox;
        var token = tokens.split(" ");
        panViewBoxX = parseFloat(token[0]);
        panViewBoxY = parseFloat(token[1]);
        panViewBoxWidth = parseFloat(token[2]);
        panViewBoxHeight = parseFloat(token[3]);
        //alert("t1:"+ panViewBoxX+" t2:"+ panViewBoxY+" t1:"+ panViewBoxWidth +" t1:"+ panViewBoxHeight);
        
        //svgDocument.style.cursor='move';
    }
    if(panAction && !panStart) {
        var p = document.documentElement.createSVGPoint();
        p.x = evt.clientX;
        p.y = evt.clientY;
        var m = svgDocument.getScreenCTM();
        p = p.matrixTransform(m.inverse());
        
        panNewX = p.x;
        panNewY = p.y;
        
        //        svgDocument = document.getElementById(svgID);
        newViewBox = svgDocument.getAttribute("viewBox");
        
        var tokens = newViewBox;
        var token = tokens.split(" ");
        panViewBoxX = parseFloat(token[0]);
        panViewBoxY = parseFloat(token[1]);
        panViewBoxWidth = parseFloat(token[2]);
        panViewBoxHeight = parseFloat(token[3]);
        
        newViewBoxX = parseFloat(panViewBoxX - (panNewX - panOldX));
        newViewBoxY = parseFloat(panViewBoxY - (panNewY - panOldY));
        
        
        
        var format =  parseFloat(newViewBoxX) + ' ' +
                      parseFloat(newViewBoxY) + ' ' +
                      parseFloat(panViewBoxWidth) + ' ' +
                      parseFloat(panViewBoxHeight);
        
        svgDocument.setAttribute('viewBox', format);
    }
}


function panEnd(evt){
    if(evt.type == "keyup"){
        if (evt.charCode) {
            var charCode = evt.charCode;
        } else {
            var charCode = evt.keyCode;
        }
        
        // spacebar
        if (charCode == 32) {
            panStart = true;
            panAction = false;
            var panViewBoxX = 0;
            var panViewBoxY = 0;
            var panViewBoxWidth = 0;
            var panViewBoxHeight = 0;
            var panOldX = 0;
            var panOldY = 0;
            var panNewX = 0;
            var panNewY = 0;
            var newViewBoxX = 0;
            var newViewBoxY = 0;
            
            svgDocument.style.cursor = 'default';
        }
        refresh = true;
    }
}

function mouseDown(evt) {
    refresh = true;
}

function mouseMove(evt) {
    if(refresh){
        refresh = false;
    }
}

function mouseUp(evt) {
    refresh = true;
}

// function to get the height of the window containing the svg in pixels; this is not the same as the svg viewbox or screen resolution
function getHeight()
{
    var y = 0;
    if (self.innerHeight){
        y = self.innerHeight;
    } else if (document.documentElement && document.documentElement.clientHeight){
        y = document.documentElement.clientHeight;
    } else if (document.body){
        y = document.body.clientHeight;
    }
    return y;
}

// function to get the width of the window containing the svg in pixels; this is not the same as the svg viewbox or screen resolution
function getWidth()
{
    var x = 0;
    if (self.innerHeight){
        x = self.innerWidth;
    } else if (document.documentElement && document.documentElement.clientHeight){
        x = document.documentElement.clientWidth;
    } else if (document.body){
        x = document.body.clientWidth;
    }
    return x;
}


// to prevent selection of text; prevent text Ibar cursor when dragging
function disableSelection(){
    var target = svgDocument;
    if (typeof target.onselectstart != "undefined"){ //IE route
        target.onselectstart = function(){return false}
    } else if (typeof target.style.MozUserSelect!="undefined"){ //Firefox route
        target.style.MozUserSelect="none"
    } else { //All other route (ie: Opera)
        target.onmousedown=function(){return false}
        target.style.cursor = "default"
    }
}
