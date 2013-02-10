// SVG Navigator
// Authors: Asad Akram, Ryan Oblenida, Peter Ryszkiewicz


// document variables
var svgElements = document.getElementsByTagName("svg");
//alert(svgElements[0]);
//alert(svgElements[1]);
//var svgID = "svg2";
if(svgElements[0] != null){
    // send request to apply svg nav icon to tab, as page action
    chrome.extension.sendRequest({}, function(response){});
    
    //    alert("No svg elements on webpage!");
    //}
    var svgDocument = svgElements[0];
    var origViewBox = svgDocument.getAttribute("viewBox");
    var newViewBox = svgDocument.getAttribute("viewBox");
    
    // variables for zooming
    //var zoomRect = document.getElementById("zoomRect");
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
    
    
    // variables for moving text
    //	var GeneralText = "General Text";
    //	var InstructionText = "Instruction Text";
    //	var origTextScale = 0;
    //	var GeneralBB = "General Bounding Box";
    //	var InstructionBB = "Instruction Bounding Box";
    //	var BoundingBox;
    //	var madeBB = false;
    //	var textflag=false;
    
    // variables for cursor events
    var event;
    
    // variable for refreshing screen
    var refresh = true;
    // variables from SVGLibrary
    var generalRows = 3;
    var instructionRows = 3;
    
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
    
}
//function init(evt) {
if(svgDocument) {
    
    // set mouse event variable
    //        event = evt;
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
    
    origTextScale = (16/screen.height)*(p.y - q.y); // roughly font size 12 at fullscreen
    
    disableSelection();
    //			textMove(GeneralText);
    //			textMove(InstructionText);
    //			textMove("System Info Box");
    //			drawBoundingBox(GeneralText);
    //			drawBoundingBox(InstructionText);
    //			drawBoundingBox("System Info Box");
    //			drawInfoBox();
}
//}

/* Zoom Functions */
// click and drag to zoom in
// click to zoom out
function zoomMouseDown(evt) {
    //    zoomRect = document.getElementById("zoomRect");
    
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
        //        zoomRect = document.getElementById("zoomRect");
        
        if(zoomRectangle) {
            var m = zoomRectangle.getScreenCTM();
            p = p.matrixTransform(m.inverse());
            
            zoomX2 = p.x;
            zoomY2 = p.y;
            zoomWidth=Math.abs(zoomX2 - zoomX1)
            zoomHeight=Math.abs(zoomY2 - zoomY1)
            if(zoomX1 < zoomX2) {
                zoomRectangle.setAttribute("x", zoomX1);
                zoomRectangle.setAttribute("width", zoomWidth);
            } else {
                zoomRectangle.setAttribute("x", zoomX2);
                zoomRectangle.setAttribute("width", zoomWidth);
            }
            
            if(zoomY1 < zoomY2){
                zoomRectangle.setAttribute("y", zoomY1);
                zoomRectangle.setAttribute("height", zoomHeight);
            } else{
                zoomRectangle.setAttribute("y", zoomY2);
                zoomRectangle.setAttribute("height", zoomHeight);
            }
        }
    }
}

// function that completes zoombox, then zooms view to zoombox
function zoomMouseUp(evt) {
    //    zoomRect = document.getElementById("zoomRect");
    var h = zoomRectangle.getAttribute("height");
    var w = zoomRectangle.getAttribute("width");
    
	// the viewbox width and height is changed when the button is up
    if(zoomAction){
        if((parseFloat(h)*parseFloat(w))<40){
            //var format =  origViewBox;
        } else {
            var format =  parseFloat(zoomRectangle.getAttribute("x")) + ' ' + parseFloat(zoomRectangle.getAttribute("y")) + ' ' + parseFloat(w) + ' ' + parseFloat(h);
            
            //            svgDocument = document.getElementById(svgID);
            svgDocument.setAttribute('viewBox', format)
        }
    }
    zoomX1 = 0;
    zoomY1 = 0;
    zoomRectangle.setAttribute("width", 0);
    zoomRectangle.setAttribute("height", 0);
    zoomAction = false;
    
}


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
            
            
            //            svgDocument = document.getElementById(svgID);
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
            
            var format =  parseFloat(newViewBoxX) + ' ' + parseFloat(newViewBoxY) + ' ' + parseFloat(newViewBoxWidth) + ' ' + parseFloat(newViewBoxHeight);
            
            svgDocument.setAttribute('viewBox', format);
            
            
            //				textMove(GeneralText);
            //				textMove(InstructionText);
            //				textMove("System Info Box");
            //				drawBoundingBox(GeneralText);
            //				drawBoundingBox(InstructionText);
            //				drawBoundingBox("System Info Box");
            //				drawInfoBox();
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
        
        // escape
        if (charCode == 27) {
            var format =  origViewBox;
			
            //            svgDocument = document.getElementById(svgID);
            svgDocument.setAttribute('viewBox', format);
			
            //				textMove(GeneralText);
            //				textMove(InstructionText);
            //				textMove("System Info Box");
            //				drawBoundingBox(GeneralText);
            //				drawBoundingBox(InstructionText);
            //				drawBoundingBox("System Info Box");
            //				drawInfoBox();
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
        
        //        svgDocument = document.getElementById(svgID);
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
        
        
        
        var format =  parseFloat(newViewBoxX) + ' ' + parseFloat(newViewBoxY) + ' ' + parseFloat(panViewBoxWidth) + ' ' + parseFloat(panViewBoxHeight);
        
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
        
        //			textMove(GeneralText);
        //			textMove(InstructionText);
        //			textMove("System Info Box");
        //			drawBoundingBox(GeneralText);
        //			drawBoundingBox(InstructionText);
        //			drawBoundingBox("System Info Box");
        //			drawInfoBox();
        refresh = true;
		
    }
}

// function to move the texts so they always stay in the corner and at a proper scale
/*
 function textMove(textID){
 svgDocument = document.getElementById(svgID);
 var m = svgDocument.getScreenCTM();
 
 var textGroup = document.getElementById(textID);
 var textGroupTransform = textGroup.getAttribute("transform");
 var tokens = textGroupTransform;
 var token = tokens.split(" ");
 var translate1 = token[0];
 var scale = token[1];
 var translate2 = token[2];
 
 var p = document.documentElement.createSVGPoint();
 p.y = getHeight();
 
 var q = document.documentElement.createSVGPoint();
 q.y = 0;
 
 var textScaleA = (16/screen.height)*(p.y - q.y); // roughly font size 12 at fullscreen
 
 p = p.matrixTransform(m.inverse());
 q = q.matrixTransform(m.inverse());
 
 var textScaleB = (16/screen.height)*(p.y - q.y); // roughly font size 12 at fullscreen
 
 p = document.documentElement.createSVGPoint();
 
 p.x = textScaleA*1;
 if(textID==InstructionText){
 p.y = getHeight() - textScaleA*0.65;
 } else if(textID==GeneralText) {
 p.y = textScaleA*1.5;
 } else if(textID=="System Info Box") {
 p.x = getWidth() - document.getElementById("System Bounding Box").getAttribute("width")*0.65;
 p.y = textScaleA*4.5;
 }
 p = p.matrixTransform(m.inverse());
 translate1 = "translate("+p.x+','+p.y+")";
 var newScale = textScaleB/origTextScale;
 scale = "scale("+newScale+','+newScale+")";
 
 textGroup = document.getElementById(textID);
 textGroup.setAttribute("transform", translate1+' '+scale+' '+translate2);
 }
 
 
 // function to draw the bounding box around general info
 function drawBoundingBox(textID){
 var elm = document.getElementById(textID);
 // fixes for 'use' elements
 if(!elm.getBBox){
 if(elm.correspondingUseElement)
 elm = elm.correspondingUseElement;
 }
 // rectangle of bounding box
 var r = elm.getBBox();
 
 // don't care about the root element
 var root = document.documentElement;
 if(textID==GeneralText){
 BoundingBox = document.getElementById(GeneralBB);
 } else if(textID==InstructionText){
 BoundingBox = document.getElementById(InstructionBB);
 } else if(textID=="System Info Box"){
 BoundingBox = document.getElementById("System Bounding Box");
 } else{
 alert("Warning - could not find general or instruction bounding box!");
 }
 
 // make new bbox
 
 if(!madeBB){
 BoundingBox.setAttributeNS(null, "fill", "beige");
 BoundingBox.setAttributeNS(null, "opacity", "1.0");
 BoundingBox.setAttributeNS(null, "stroke", "black");
 BoundingBox.setAttributeNS(null, "stroke-width", "1");
 BoundingBox.setAttributeNS(null, "pointer-events", "none");
 }
 
 // pad the rectangle
 BoundingBox.x.baseVal.value = r.x - 10;
 BoundingBox.y.baseVal.value = r.y - 7;
 BoundingBox.width.baseVal.value = r.width + 20;
 BoundingBox.height.baseVal.value = r.height + 14;
 
 // make the bbox rect element transform to the given text
 BoundingBox.transform.baseVal.clear();
 var tfm2elm = elm.getTransformToElement(BoundingBox);
 BoundingBox.transform.baseVal.appendItem(BoundingBox.transform.baseVal.createSVGTransformFromMatrix(tfm2elm));
 }
 
 
 // function to draw the bounding box around other text info
 function drawBoundingBox2(textID){
 var elm = document.getElementById(textID);
 // fixes for 'use' elements
 if(!elm.getBBox){
 if(elm.correspondingUseElement)
 elm = elm.correspondingUseElement;
 }
 // rectangle of bounding box
 var r = elm.getBBox();
 
 // don't care about the root element
 var root = document.documentElement;
 BoundingBox = document.getElementById('Info Bounding Box1');
 
 // make new bbox
 
 if(!madeBB){
 BoundingBox.setAttributeNS(null, "fill", "beige");
 BoundingBox.setAttributeNS(null, "opacity", "1.0");
 BoundingBox.setAttributeNS(null, "stroke", "black");
 BoundingBox.setAttributeNS(null, "stroke-width", "1");
 BoundingBox.setAttributeNS(null, "pointer-events", "none");
 }
 
 
 // pad the rectangle
 BoundingBox.x.baseVal.value = r.x - 10;
 BoundingBox.y.baseVal.value = r.y - 7;
 BoundingBox.width.baseVal.value = r.width + 20;
 BoundingBox.height.baseVal.value = r.height + 14;
 
 // make the bbox rect element transform to the given text
 BoundingBox.transform.baseVal.clear();
 var tfm2elm = elm.getTransformToElement(BoundingBox);
 BoundingBox.transform.baseVal.appendItem(BoundingBox.transform.baseVal.createSVGTransformFromMatrix(tfm2elm));
 BoundingBox = document.getElementById('Info Bounding Box1');
 
 // make the connector element transform to the given text
 var connector = document.getElementById("Info Bounding Box Connector");
 connector.transform.baseVal.clear();
 //tfm2elm.e = 0; tfm2elm.f = 0; // clear translates
 connector.transform.baseVal.appendItem(connector.transform.baseVal.createSVGTransformFromMatrix(tfm2elm));
 connector.x2.baseVal.value = BoundingBox.x.baseVal.value;
 connector.y2.baseVal.value = BoundingBox.y.baseVal.value + BoundingBox.height.baseVal.value;
 }
 
 
 // function to draw the bounding box around section text info for sliding text box
 function drawBoundingBox3(textID){
 var elm = document.getElementById(textID);
 // fixes for 'use' elements
 if(!elm.getBBox){
 if(elm.correspondingUseElement)
 elm = elm.correspondingUseElement;
 }
 // get mouse coordinates
 var p = document.documentElement.createSVGPoint();
 p.x = event.clientX;
 p.y = event.clientY;
 var m = svgDocument.getScreenCTM();
 p = p.matrixTransform(m.inverse());
 
 var x = p.x;
 var y = p.y;
 
 // get text id
 var textGroupID = elm.getAttribute("id");
 var tokens = textGroupID;
 var token = tokens.split(":");
 var junk = token[0];
 var tempID = token[1];
 
 // get line element to get line's coordinates
 var sectionLine = document.getElementById('Line ID:'+tempID);
 
 var x1 = sectionLine.getAttribute('x1');
 var y1 = sectionLine.getAttribute('y1');
 var x2 = sectionLine.getAttribute('x2');
 var y2 = sectionLine.getAttribute('y2');
 
 // algorithm to get closest point on line from user's cursor
 var A = x - x1;
 var B = y - y1;
 var C = x2 - x1;
 var D = y2 - y1;
 
 var dot = A * C + B * D;
 var len_sq = C * C + D * D;
 var param = dot / len_sq;
 
 // (xx,yy) = the closest point on line from user's cursor
 var xx,yy;
 
 xx = parseFloat(x1) + parseFloat(param) * parseFloat(C);
 yy = parseFloat(y1) + parseFloat(param) * parseFloat(D);
 
 var textGroupTransform = elm.getAttribute("transform");
 var tokens = textGroupTransform;
 var token = tokens.split(" ");
 var translate1 = token[0];
 var scale = token[1];
 
 translate1 = "translate("+xx+','+yy+")";
 
 textGroup = document.getElementById(textID);
 textGroup.setAttribute("transform", translate1+' '+scale);
 
 // rectangle of bounding box
 var r = elm.getBBox();
 
 // don't care about the root element
 var root = document.documentElement;
 BoundingBox = document.getElementById('Info Bounding Box1');
 
 // make new bbox
 
 if(!madeBB){
 BoundingBox.setAttributeNS(null, "fill", "beige");
 BoundingBox.setAttributeNS(null, "opacity", "1.0");
 BoundingBox.setAttributeNS(null, "stroke", "black");
 BoundingBox.setAttributeNS(null, "stroke-width", "1");
 BoundingBox.setAttributeNS(null, "pointer-events", "none");
 }
 
 
 // pad the rectangle
 BoundingBox.x.baseVal.value = r.x - 10;
 BoundingBox.y.baseVal.value = r.y - 7;
 BoundingBox.width.baseVal.value = r.width + 20;
 BoundingBox.height.baseVal.value = r.height + 14;
 
 // make the bbox rect element transform to the given text
 BoundingBox.transform.baseVal.clear();
 var tfm2elm = elm.getTransformToElement(BoundingBox);
 BoundingBox.transform.baseVal.appendItem(BoundingBox.transform.baseVal.createSVGTransformFromMatrix(tfm2elm));
 BoundingBox = document.getElementById('Info Bounding Box1');
 
 // make the connector element transform to the given text
 var connector = document.getElementById("Info Bounding Box Connector");
 connector.transform.baseVal.clear();
 //tfm2elm.e = 0; tfm2elm.f = 0; // clear translates
 connector.transform.baseVal.appendItem(connector.transform.baseVal.createSVGTransformFromMatrix(tfm2elm));
 connector.x2.baseVal.value = BoundingBox.x.baseVal.value;
 connector.y2.baseVal.value = BoundingBox.y.baseVal.value + BoundingBox.height.baseVal.value;
 }
 
 // function to draw the bounding box around other text info
 function drawBoundingBox5(textID, nodeX, nodeY){
 var elm = document.getElementById(textID);
 // fixes for 'use' elements
 if(!elm.getBBox){
 if(elm.correspondingUseElement)
 elm = elm.correspondingUseElement;
 }
 // rectangle of bounding box
 var r = elm.getBBox();
 
 // don't care about the root element
 var root = document.documentElement;
 BoundingBox = document.getElementById('Info Bounding Box1');
 
 
 // pad the rectangle
 BoundingBox.x.baseVal.value = r.x - 10;
 BoundingBox.y.baseVal.value = r.y - 7;
 BoundingBox.width.baseVal.value = r.width + 20;
 BoundingBox.height.baseVal.value = r.height + 14;
 
 // make the bbox rect element transform to the given text
 BoundingBox.transform.baseVal.clear();
 var tfm2elm = elm.getTransformToElement(BoundingBox);
 BoundingBox.transform.baseVal.appendItem(BoundingBox.transform.baseVal.createSVGTransformFromMatrix(tfm2elm));
 
 // make the connector element transform to the given text
 var connector = document.getElementById("Info Bounding Box Connector");
 //connector.transform.baseVal.clear();
 //tfm2elm.e = "0"; tfm2elm.f = "0";
 //connector.transform.baseVal.appendItem(connector.transform.baseVal.createSVGTransformFromMatrix(tfm2elm));
 
 //tfm2elm = elm.getTransformToElement(BoundingBox);
 
 //connector.x1.baseVal.value = oldE;
 //connector.y1.baseVal.value = oldF;
 //alert("new");
 
 //connector.x2.baseVal.value = BoundingBox.x.baseVal.value + oldE;
 //connector.y2.baseVal.value = BoundingBox.y.baseVal.value + BoundingBox.height.baseVal.value + oldF;
 
 //alert("connector.x1.baseVal.value = "+connector.x1.baseVal.value);
 //alert("connector.x2.baseVal.value = "+connector.x2.baseVal.value +", tfm2elm.e= "+tfm2elm.e);
 
 
 var token = document.getElementById(svgID).getAttribute("viewBox").split(" ");
 var ViewBoxX1 = parseFloat(token[0]);
 var ViewBoxY1 = parseFloat(token[1]);
 var ViewBoxWidth = parseFloat(token[2]);
 var ViewBoxHeight = parseFloat(token[3]);
 var ViewBoxX2 = ViewBoxX1 + ViewBoxWidth;
 var ViewBoxY2 = ViewBoxY1 + ViewBoxHeight;
 //alert(ViewBoxX1);
 //alert(ViewBoxY1);
 //alert(ViewBoxX2);
 //alert(ViewBoxY2);
 
 var BBX1 = nodeX + BoundingBox.x.baseVal.value;
 var BBY1 = nodeY + BoundingBox.y.baseVal.value;
 var BBX2 = BBX1 + BoundingBox.width.baseVal.value;
 var BBY2 = BBY1 + BoundingBox.height.baseVal.value;
 var BBWidth = BoundingBox.width.baseVal.value;
 var BBHeight = BoundingBox.height.baseVal.value;
 
 //alert(BBX1);
 //alert(BBY1);
 
 
 
 var token = document.getElementById(textID).getAttribute("transform").split(" ");
 var translate1 = token[0];
 var scale = token[1];
 
 
 // three cases for text being outside of viewbox
 if((BBY1<ViewBoxY1) && (BBX2<ViewBoxX2)){          // case 1, text is above viewbox
 //textGroup.setAttribute("transform", translate1+' '+scale+' '+translate2);
 // retranslate text
 translate1 = "translate("+nodeX+','+(nodeY - 2*BoundingBox.y.baseVal.value - BBHeight)+")";
 elm.setAttribute("transform", translate1+' '+scale);
 
 
 
 // rectangle of bounding box
 r = elm.getBBox();
 
 // don't care about the root element
 BoundingBox = document.getElementById('Info Bounding Box1');
 
 // pad the rectangle
 BoundingBox.x.baseVal.value = r.x - 10;
 BoundingBox.y.baseVal.value = r.y - 7;
 BoundingBox.width.baseVal.value = r.width + 20;
 BoundingBox.height.baseVal.value = r.height + 14;
 
 // make the bbox rect element transform to the given text
 BoundingBox.transform.baseVal.clear();
 var tfm2elm = elm.getTransformToElement(BoundingBox);
 var oldE = tfm2elm.e;
 var oldF = tfm2elm.f;
 BoundingBox.transform.baseVal.appendItem(BoundingBox.transform.baseVal.createSVGTransformFromMatrix(tfm2elm));
 
 
 // make the connector element transform to the given text
 //var connector = document.getElementById("Info Bounding Box Connector");
 connector.transform.baseVal.clear();
 tfm2elm.e = "0"; tfm2elm.f = "0";
 connector.transform.baseVal.appendItem(connector.transform.baseVal.createSVGTransformFromMatrix(tfm2elm));
 
 connector.x1.baseVal.value = nodeX;
 connector.y1.baseVal.value = nodeY;
 
 connector.x2.baseVal.value = BoundingBox.x.baseVal.value + oldE;
 connector.y2.baseVal.value = BoundingBox.y.baseVal.value + oldF;
 //alert("1");
 //alert("tfm2elm.e: "+ tfm2elm.e + ", tfm2elm.f: "+ tfm2elm.f);
 
 //drawBoundingBox2(textID);
 //return;
 } else if((BBY1<ViewBoxY1) && (BBX2>ViewBoxX2)){          // case 2, text is above viewbox and to the right
 // retranslate text
 translate1 = "translate("+(nodeX- 2*BoundingBox.x.baseVal.value - BBWidth)+','+(nodeY - 2*BoundingBox.y.baseVal.value - BBHeight)+")";
 elm.setAttribute("transform", translate1+' '+scale);
 
 
 
 // rectangle of bounding box
 r = elm.getBBox();
 
 // don't care about the root element
 BoundingBox = document.getElementById('Info Bounding Box1');
 
 // pad the rectangle
 BoundingBox.x.baseVal.value = r.x - 10;
 BoundingBox.y.baseVal.value = r.y - 7;
 BoundingBox.width.baseVal.value = r.width + 20;
 BoundingBox.height.baseVal.value = r.height + 14;
 
 // make the bbox rect element transform to the given text
 BoundingBox.transform.baseVal.clear();
 var tfm2elm = elm.getTransformToElement(BoundingBox);
 var oldE = tfm2elm.e;
 var oldF = tfm2elm.f;
 BoundingBox.transform.baseVal.appendItem(BoundingBox.transform.baseVal.createSVGTransformFromMatrix(tfm2elm));
 
 
 // make the connector element transform to the given text
 //var connector = document.getElementById("Info Bounding Box Connector");
 connector.transform.baseVal.clear();
 tfm2elm.e = "0"; tfm2elm.f = "0";
 connector.transform.baseVal.appendItem(connector.transform.baseVal.createSVGTransformFromMatrix(tfm2elm));
 
 connector.x1.baseVal.value = nodeX;
 connector.y1.baseVal.value = nodeY;
 
 connector.x2.baseVal.value = BoundingBox.x.baseVal.value + BBWidth + oldE;
 connector.y2.baseVal.value = BoundingBox.y.baseVal.value + oldF;
 
 
 //translate1 = "translate("+BBX1+','+2*connector.y1.baseVal.value - connector.y2.baseVal.value + BoundingBox.height.baseVal.value+")";
 //elm.setAttribute("transform", translate1+' '+scale);
 //alert("2");
 //drawBoundingBox4(textID);
 } else if((BBY1>ViewBoxY1) && (BBX2>ViewBoxX2)){          // case 3, text is to the right of viewbox
 //translate1 = "translate("+BBX1+','+connector.y1.baseVal.value + connector.y2.baseVal.value+")";
 //elm.setAttribute("transform", translate1+' '+scale);
 
 
 // retranslate text
 translate1 = "translate("+(nodeX- 2*BoundingBox.x.baseVal.value - BBWidth)+','+(nodeY)+")";
 elm.setAttribute("transform", translate1+' '+scale);
 
 
 
 // rectangle of bounding box
 r = elm.getBBox();
 
 // don't care about the root element
 BoundingBox = document.getElementById('Info Bounding Box1');
 
 // pad the rectangle
 BoundingBox.x.baseVal.value = r.x - 10;
 BoundingBox.y.baseVal.value = r.y - 7;
 BoundingBox.width.baseVal.value = r.width + 20;
 BoundingBox.height.baseVal.value = r.height + 14;
 
 // make the bbox rect element transform to the given text
 BoundingBox.transform.baseVal.clear();
 var tfm2elm = elm.getTransformToElement(BoundingBox);
 var oldE = tfm2elm.e;
 var oldF = tfm2elm.f;
 BoundingBox.transform.baseVal.appendItem(BoundingBox.transform.baseVal.createSVGTransformFromMatrix(tfm2elm));
 
 
 // make the connector element transform to the given text
 //var connector = document.getElementById("Info Bounding Box Connector");
 connector.transform.baseVal.clear();
 tfm2elm.e = "0"; tfm2elm.f = "0";
 connector.transform.baseVal.appendItem(connector.transform.baseVal.createSVGTransformFromMatrix(tfm2elm));
 
 connector.x1.baseVal.value = nodeX;
 connector.y1.baseVal.value = nodeY;
 
 connector.x2.baseVal.value = BoundingBox.x.baseVal.value + BBWidth + oldE;
 connector.y2.baseVal.value = BoundingBox.y.baseVal.value + BoundingBox.height.baseVal.value + oldF;
 
 
 //alert("3");
 //drawBoundingBox4(textID);
 }
 // good case
 else{
 // rectangle of bounding box
 var r = elm.getBBox();
 
 // don't care about the root element
 var root = document.documentElement;
 BoundingBox = document.getElementById('Info Bounding Box1');
 
 // pad the rectangle
 BoundingBox.x.baseVal.value = r.x - 10;
 BoundingBox.y.baseVal.value = r.y - 7;
 BoundingBox.width.baseVal.value = r.width + 20;
 BoundingBox.height.baseVal.value = r.height + 14;
 
 // make the bbox rect element transform to the given text
 BoundingBox.transform.baseVal.clear();
 var tfm2elm = elm.getTransformToElement(BoundingBox);
 //var nodeX = tfm2elm.e;
 //var oldF = tfm2elm.f;
 BoundingBox.transform.baseVal.appendItem(BoundingBox.transform.baseVal.createSVGTransformFromMatrix(tfm2elm));
 //BoundingBox = document.getElementById('Info Bounding Box1');
 
 // make the connector element transform to the given text
 //var connector = document.getElementById("Info Bounding Box Connector");
 connector.transform.baseVal.clear();
 tfm2elm.e = "0"; tfm2elm.f = "0";
 connector.transform.baseVal.appendItem(connector.transform.baseVal.createSVGTransformFromMatrix(tfm2elm));
 
 connector.x1.baseVal.value = nodeX;
 connector.y1.baseVal.value = nodeY;
 connector.x2.baseVal.value = BoundingBox.x.baseVal.value + nodeX;
 connector.y2.baseVal.value = BoundingBox.y.baseVal.value + BoundingBox.height.baseVal.value + nodeY;
 
 }
 }
 
 // function to draw the bounding box around section text info for sliding text box
 function drawBoundingBox6(textID){
 var elm = document.getElementById(textID);
 // fixes for 'use' elements
 if(!elm.getBBox){
 if(elm.correspondingUseElement)
 elm = elm.correspondingUseElement;
 }
 // get mouse coordinates
 var p = document.documentElement.createSVGPoint();
 p.x = event.clientX;
 p.y = event.clientY;
 var m = svgDocument.getScreenCTM();
 p = p.matrixTransform(m.inverse());
 
 var x = p.x;
 var y = p.y;
 
 // get text id
 var textGroupID = elm.getAttribute("id");
 var tokens = textGroupID;
 var token = tokens.split(":");
 var junk = token[0];
 var tempID = token[1];
 
 // get line element to get line's coordinates
 var sectionLine = document.getElementById('Line ID:'+tempID);
 
 var x1 = sectionLine.getAttribute('x1');
 var y1 = sectionLine.getAttribute('y1');
 var x2 = sectionLine.getAttribute('x2');
 var y2 = sectionLine.getAttribute('y2');
 
 // algorithm to get closest point on line from user's cursor
 var A = x - x1;
 var B = y - y1;
 var C = x2 - x1;
 var D = y2 - y1;
 
 var dot = A * C + B * D;
 var len_sq = C * C + D * D;
 var param = dot / len_sq;
 
 // (xx,yy) = the closest point on line from user's cursor
 var xx,yy;
 
 xx = parseFloat(x1) + parseFloat(param) * parseFloat(C);
 yy = parseFloat(y1) + parseFloat(param) * parseFloat(D);
 var centerX = xx;
 var centerY = yy;
 
 var textGroupTransform = elm.getAttribute("transform");
 var tokens = textGroupTransform;
 var token = tokens.split(" ");
 var translate1 = token[0];
 var scale = token[1];
 
 translate1 = "translate("+xx+','+yy+")";
 
 textGroup = document.getElementById(textID);
 textGroup.setAttribute("transform", translate1+' '+scale);
 
 // rectangle of bounding box
 var r = elm.getBBox();
 
 // don't care about the root element
 var root = document.documentElement;
 BoundingBox = document.getElementById('Info Bounding Box1');
 
 
 // pad the rectangle
 BoundingBox.x.baseVal.value = r.x - 10;
 BoundingBox.y.baseVal.value = r.y - 7;
 BoundingBox.width.baseVal.value = r.width + 20;
 BoundingBox.height.baseVal.value = r.height + 14;
 
 
 // make the bbox rect element transform to the given text
 BoundingBox.transform.baseVal.clear();
 var tfm2elm = elm.getTransformToElement(BoundingBox);
 BoundingBox.transform.baseVal.appendItem(BoundingBox.transform.baseVal.createSVGTransformFromMatrix(tfm2elm));
 
 // make the connector element transform to the given text
 var connector = document.getElementById("Info Bounding Box Connector");
 //connector.transform.baseVal.clear();
 //tfm2elm.e = "0"; tfm2elm.f = "0";
 //connector.transform.baseVal.appendItem(connector.transform.baseVal.createSVGTransformFromMatrix(tfm2elm));
 
 //tfm2elm = elm.getTransformToElement(BoundingBox);
 
 //connector.x1.baseVal.value = oldE;
 //connector.y1.baseVal.value = oldF;
 //alert("new");
 
 //connector.x2.baseVal.value = BoundingBox.x.baseVal.value + oldE;
 //connector.y2.baseVal.value = BoundingBox.y.baseVal.value + BoundingBox.height.baseVal.value + oldF;
 
 //alert("connector.x1.baseVal.value = "+connector.x1.baseVal.value);
 //alert("connector.x2.baseVal.value = "+connector.x2.baseVal.value +", tfm2elm.e= "+tfm2elm.e);
 
 
 var token = document.getElementById(svgID).getAttribute("viewBox").split(" ");
 var ViewBoxX1 = parseFloat(token[0]);
 var ViewBoxY1 = parseFloat(token[1]);
 var ViewBoxWidth = parseFloat(token[2]);
 var ViewBoxHeight = parseFloat(token[3]);
 var ViewBoxX2 = ViewBoxX1 + ViewBoxWidth;
 var ViewBoxY2 = ViewBoxY1 + ViewBoxHeight;
 //alert(ViewBoxX1);
 //alert(ViewBoxY1);
 //alert(ViewBoxX2);
 //alert(ViewBoxY2);
 
 var BBX1 = centerX + BoundingBox.x.baseVal.value;
 var BBY1 = centerY + BoundingBox.y.baseVal.value;
 var BBX2 = BBX1 + BoundingBox.width.baseVal.value;
 var BBY2 = BBY1 + BoundingBox.height.baseVal.value;
 var BBWidth = BoundingBox.width.baseVal.value;
 var BBHeight = BoundingBox.height.baseVal.value;
 
 //alert(BBX1);
 //alert(BBY1);
 
 
 
 var token = document.getElementById(textID).getAttribute("transform").split(" ");
 var translate1 = token[0];
 var scale = token[1];
 
 
 // three cases for text being outside of viewbox
 if((BBY1<ViewBoxY1) && (BBX2<ViewBoxX2)){          // case 1, text is above viewbox
 //textGroup.setAttribute("transform", translate1+' '+scale+' '+translate2);
 // retranslate text
 translate1 = "translate("+centerX+','+(centerY - 2*BoundingBox.y.baseVal.value - BBHeight)+")";
 elm.setAttribute("transform", translate1+' '+scale);
 
 
 
 // rectangle of bounding box
 r = elm.getBBox();
 
 // don't care about the root element
 BoundingBox = document.getElementById('Info Bounding Box1');
 
 // pad the rectangle
 BoundingBox.x.baseVal.value = r.x - 10;
 BoundingBox.y.baseVal.value = r.y - 7;
 BoundingBox.width.baseVal.value = r.width + 20;
 BoundingBox.height.baseVal.value = r.height + 14;
 
 // make the bbox rect element transform to the given text
 BoundingBox.transform.baseVal.clear();
 var tfm2elm = elm.getTransformToElement(BoundingBox);
 var oldE = tfm2elm.e;
 var oldF = tfm2elm.f;
 BoundingBox.transform.baseVal.appendItem(BoundingBox.transform.baseVal.createSVGTransformFromMatrix(tfm2elm));
 
 
 // make the connector element transform to the given text
 //var connector = document.getElementById("Info Bounding Box Connector");
 connector.transform.baseVal.clear();
 tfm2elm.e = "0"; tfm2elm.f = "0";
 connector.transform.baseVal.appendItem(connector.transform.baseVal.createSVGTransformFromMatrix(tfm2elm));
 
 connector.x1.baseVal.value = centerX;
 connector.y1.baseVal.value = centerY;
 
 connector.x2.baseVal.value = BoundingBox.x.baseVal.value + oldE;
 connector.y2.baseVal.value = BoundingBox.y.baseVal.value + oldF;
 //alert("1");
 //alert("tfm2elm.e: "+ tfm2elm.e + ", tfm2elm.f: "+ tfm2elm.f);
 
 //drawBoundingBox2(textID);
 //return;
 } else if((BBY1<ViewBoxY1) && (BBX2>ViewBoxX2)){          // case 2, text is above viewbox and to the right
 // retranslate text
 translate1 = "translate("+(centerX- 2*BoundingBox.x.baseVal.value - BBWidth)+','+(centerY - 2*BoundingBox.y.baseVal.value - BBHeight)+")";
 elm.setAttribute("transform", translate1+' '+scale);
 
 
 
 // rectangle of bounding box
 r = elm.getBBox();
 
 // don't care about the root element
 BoundingBox = document.getElementById('Info Bounding Box1');
 
 // pad the rectangle
 BoundingBox.x.baseVal.value = r.x - 10;
 BoundingBox.y.baseVal.value = r.y - 7;
 BoundingBox.width.baseVal.value = r.width + 20;
 BoundingBox.height.baseVal.value = r.height + 14;
 
 // make the bbox rect element transform to the given text
 BoundingBox.transform.baseVal.clear();
 var tfm2elm = elm.getTransformToElement(BoundingBox);
 var oldE = tfm2elm.e;
 var oldF = tfm2elm.f;
 BoundingBox.transform.baseVal.appendItem(BoundingBox.transform.baseVal.createSVGTransformFromMatrix(tfm2elm));
 
 
 // make the connector element transform to the given text
 //var connector = document.getElementById("Info Bounding Box Connector");
 connector.transform.baseVal.clear();
 tfm2elm.e = "0"; tfm2elm.f = "0";
 connector.transform.baseVal.appendItem(connector.transform.baseVal.createSVGTransformFromMatrix(tfm2elm));
 
 connector.x1.baseVal.value = centerX;
 connector.y1.baseVal.value = centerY;
 
 connector.x2.baseVal.value = BoundingBox.x.baseVal.value + BBWidth + oldE;
 connector.y2.baseVal.value = BoundingBox.y.baseVal.value + oldF;
 
 
 //translate1 = "translate("+BBX1+','+2*connector.y1.baseVal.value - connector.y2.baseVal.value + BoundingBox.height.baseVal.value+")";
 //elm.setAttribute("transform", translate1+' '+scale);
 //alert("2");
 //drawBoundingBox4(textID);
 } else if((BBY1>ViewBoxY1) && (BBX2>ViewBoxX2)){          // case 3, text is to the right of viewbox
 //translate1 = "translate("+BBX1+','+connector.y1.baseVal.value + connector.y2.baseVal.value+")";
 //elm.setAttribute("transform", translate1+' '+scale);
 
 
 // retranslate text
 translate1 = "translate("+(centerX- 2*BoundingBox.x.baseVal.value - BBWidth)+','+(centerY)+")";
 elm.setAttribute("transform", translate1+' '+scale);
 
 
 
 // rectangle of bounding box
 r = elm.getBBox();
 
 // don't care about the root element
 BoundingBox = document.getElementById('Info Bounding Box1');
 
 // pad the rectangle
 BoundingBox.x.baseVal.value = r.x - 10;
 BoundingBox.y.baseVal.value = r.y - 7;
 BoundingBox.width.baseVal.value = r.width + 20;
 BoundingBox.height.baseVal.value = r.height + 14;
 
 // make the bbox rect element transform to the given text
 BoundingBox.transform.baseVal.clear();
 var tfm2elm = elm.getTransformToElement(BoundingBox);
 var oldE = tfm2elm.e;
 var oldF = tfm2elm.f;
 BoundingBox.transform.baseVal.appendItem(BoundingBox.transform.baseVal.createSVGTransformFromMatrix(tfm2elm));
 
 
 // make the connector element transform to the given text
 //var connector = document.getElementById("Info Bounding Box Connector");
 connector.transform.baseVal.clear();
 tfm2elm.e = "0"; tfm2elm.f = "0";
 connector.transform.baseVal.appendItem(connector.transform.baseVal.createSVGTransformFromMatrix(tfm2elm));
 
 connector.x1.baseVal.value = centerX;
 connector.y1.baseVal.value = centerY;
 
 connector.x2.baseVal.value = BoundingBox.x.baseVal.value + BBWidth + oldE;
 connector.y2.baseVal.value = BoundingBox.y.baseVal.value + BoundingBox.height.baseVal.value + oldF;
 
 
 //alert("3");
 //drawBoundingBox4(textID);
 }
 // good case
 else{
 // rectangle of bounding box
 var r = elm.getBBox();
 
 // don't care about the root element
 var root = document.documentElement;
 BoundingBox = document.getElementById('Info Bounding Box1');
 
 // pad the rectangle
 BoundingBox.x.baseVal.value = r.x - 10;
 BoundingBox.y.baseVal.value = r.y - 7;
 BoundingBox.width.baseVal.value = r.width + 20;
 BoundingBox.height.baseVal.value = r.height + 14;
 
 // make the bbox rect element transform to the given text
 BoundingBox.transform.baseVal.clear();
 var tfm2elm = elm.getTransformToElement(BoundingBox);
 //var centerX = tfm2elm.e;
 //var oldF = tfm2elm.f;
 BoundingBox.transform.baseVal.appendItem(BoundingBox.transform.baseVal.createSVGTransformFromMatrix(tfm2elm));
 //BoundingBox = document.getElementById('Info Bounding Box1');
 
 // make the connector element transform to the given text
 //var connector = document.getElementById("Info Bounding Box Connector");
 connector.transform.baseVal.clear();
 tfm2elm.e = "0"; tfm2elm.f = "0";
 connector.transform.baseVal.appendItem(connector.transform.baseVal.createSVGTransformFromMatrix(tfm2elm));
 
 connector.x1.baseVal.value = centerX;
 connector.y1.baseVal.value = centerY;
 connector.x2.baseVal.value = BoundingBox.x.baseVal.value + centerX;
 connector.y2.baseVal.value = BoundingBox.y.baseVal.value + BoundingBox.height.baseVal.value + centerY;
 
 }
 }
 */

/*
 function drawInfoBox(){
 svgDocument = document.getElementById("cont");
 var m = svgDocument.getScreenCTM();
 
 var textGroup;
 var tokens;
 var token;
 var translate1;
 var scale;
 
 var p = document.documentElement.createSVGPoint();
 p.y = getHeight();
 
 var q = document.documentElement.createSVGPoint();
 q.y = 0;
 
 p = p.matrixTransform(m.inverse());
 q = q.matrixTransform(m.inverse());
 
 var textScaleB = (16/screen.height)*(p.y - q.y); // roughly font size 12 at fullscreen
 
 var newScale = textScaleB/origTextScale;
 scale = "scale("+newScale+','+newScale+")";
 
 var nodes=["SOURCE_NODE_1","650","632","634","645","646","671","680","684","611","652","675","699"];
 var i=0;
 for (i=0;i<13;i++){
 textGroup = document.getElementById("Node Info Box: " + nodes[i]);
 tokens = textGroup.getAttribute("transform");
 token = tokens.split(" ");
 translate1 = token[0];
 textGroup.setAttribute("transform", translate1+' '+scale);
 }
 var sections=["FEEDER_TO_T1_S","FEEDER_TO_T1_L","650_632_S","650_632_L","632_634_S","632_634_L","632_645_S","632_645_L","645_646_S","645_646_L","632_699_S","632_699_L","699_671_S","699_671_L","671_680_S","671_680_L","671_675_S","671_675_L","671_684_S","671_684_L","684_611_S","684_611_L","684_652_S","684_652_L"];
 i=0;
 for (i=0;i<24;i++){
 textGroup = document.getElementById("Section Info Box: " + sections[i]);
 tokens = textGroup.getAttribute("transform");
 token = tokens.split(" ");
 translate1 = token[0];
 textGroup.setAttribute("transform", translate1+' '+scale);
 }
 var loads=["allocated load at node 634 (0)","allocated load at node 645 (0)","allocated load at node 646 (0)","allocated load at node 652 (0)","allocated load at node 671 (0)","allocated load at node 675 (0)","allocated load at node 671 (1)","allocated load at node 611 (0)","allocated load at node 699 (0)"];
 i=0;
 for (i=0;i<9;i++){
 textGroup = document.getElementById("Info Box for " + loads[i]);
 tokens = textGroup.getAttribute("transform");
 token = tokens.split(" ");
 translate1 = token[0];
 textGroup.setAttribute("transform", translate1+' '+scale);
 }
 var shuntCaps=["shunt capacitor at node 611 (1)","shunt capacitor at node 675 (1)"];
 i=0;
 for (i=0;i<2;i++){
 textGroup = document.getElementById("Info Box for " + shuntCaps[i]);
 tokens = textGroup.getAttribute("transform");
 token = tokens.split(" ");
 translate1 = token[0];
 textGroup.setAttribute("transform", translate1+' '+scale);
 }
 var regs=["IEEE13N"];
 i=0;
 for (i=0;i<1;i++){
 textGroup = document.getElementById("Regulator Info Box: " + regs[i]);
 tokens = textGroup.getAttribute("transform");
 token = tokens.split(" ");
 translate1 = token[0];
 textGroup.setAttribute("transform", translate1+' '+scale);
 }
 var trans=["XFM-1","SUBXFM"];
 i=0;
 for (i=0;i<2;i++){
 textGroup = document.getElementById("Transformer Info Box: " + trans[i]);
 tokens = textGroup.getAttribute("transform");
 token = tokens.split(" ");
 translate1 = token[0];
 textGroup.setAttribute("transform", translate1+' '+scale);
 }
 var switches=["650_632_L","632_699_S","671_675_S"];
 i=0;
 for (i=0;i<3;i++){
 textGroup = document.getElementById("Switch Info Box: " + switches[i]);
 tokens = textGroup.getAttribute("transform");
 token = tokens.split(" ");
 translate1 = token[0];
 textGroup.setAttribute("transform", translate1+' '+scale);
 }
 }
 */

function mouseDown(evt) {
    //		textMove(GeneralText);
    //		textMove(InstructionText);
    //		textMove("System Info Box");
    //		drawBoundingBox(GeneralText);
    //		drawBoundingBox(InstructionText);
    //		drawBoundingBox("System Info Box");
    //		drawInfoBox();
    refresh = true;
}

function mouseMove(evt) {
    if(refresh){
        //			textMove(GeneralText);
        //			textMove(InstructionText);
        //			textMove("System Info Box");
        //			drawBoundingBox(GeneralText);
        //			drawBoundingBox(InstructionText);
        //			drawBoundingBox("System Info Box");
        //			drawInfoBox();
        refresh = false;
    }
}

function mouseUp(evt) {
    //		textMove(GeneralText);
    //		textMove(InstructionText);
    //		textMove("System Info Box");
    //		drawBoundingBox(GeneralText);
    //		drawBoundingBox(InstructionText);
    //		drawBoundingBox("System Info Box");
    //		drawInfoBox();
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
    //    var target = document.getElementById(svgID);
    var target = svgDocument;
    if (typeof target.onselectstart!="undefined"){ //IE route
        target.onselectstart=function(){return false}
    } else if (typeof target.style.MozUserSelect!="undefined"){ //Firefox route
        target.style.MozUserSelect="none"
    } else { //All other route (ie: Opera)
        target.onmousedown=function(){return false}
        target.style.cursor = "default"
    }
}
