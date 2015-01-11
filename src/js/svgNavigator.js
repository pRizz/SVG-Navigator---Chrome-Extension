/*
 * Copyright (c) 2013, Asad Akram, Ryan Oblenida, Peter Ryszkiewicz
 * All rights reserved.
 *
 * Redistribution and use in source and binary forms, with or without
 * modification, are permitted provided that the following conditions are met:
 *
 * 1. Redistributions of source code must retain the above copyright notice, this
 *    list of conditions and the following disclaimer.
 * 2. Redistributions in binary form must reproduce the above copyright notice,
 *    this list of conditions and the following disclaimer in the documentation
 *    and/or other materials provided with the distribution.
 *
 * THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS" AND
 * ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED
 * WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE
 * DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT OWNER OR CONTRIBUTORS BE LIABLE FOR
 * ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES
 * (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES;
 * LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND
 * ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT
 * (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF THIS
 * SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
 */
 
/*
 * svgNavigator.js
 */

// define svg namespace
var svgNS = "http://www.w3.org/2000/svg";

var baseURI = document.rootElement ? document.rootElement.baseURI : undefined;
if(baseURI && baseURI.indexOf(".svg", baseURI.length - 4) !== -1){
	// wrap the svg document in an html document
	var svgDoc = document;
	var svgDocElement = svgDoc.documentElement;
	var htmlDoc = document.implementation.createHTMLDocument();

	svgContext = svgDocElement;
	document.replaceChild(htmlDoc.documentElement, svgDoc.documentElement);

	// the htmlDoc is the new document object
	document.body.appendChild(svgDocElement)
	document.body.style.margin = 0;

	// document variables
	var svgElements = document.getElementsByTagName("svg");
	
    // send request to apply svg nav icon to tab, as page action
    chrome.extension.sendRequest("showIcon", function(response){});
    
    var svgDocument = svgElements[0];
    
    // keep aspect ratio; just remove attribute if it exists
    svgDocument.hasAttribute("preserveAspectRatio") ? svgDocument.removeAttribute("preserveAspectRatio") : null;
    
    // save original svg width and height
    // TODO problematic when width or height contain percent character
    var origSVGWidth = svgDocument.hasAttribute("width") ? svgDocument.getAttribute("width"): getWidth();
    var origSVGHeight = svgDocument.hasAttribute("height") ? svgDocument.getAttribute("height"): getHeight();
    // make width and height 100% to fill client web browser
    svgDocument.setAttribute("width", "100%");
    svgDocument.setAttribute("height", "100%");
    
    var origViewBox = svgDocument.getAttribute("viewBox");
    // check if the svg document had a viewbox
    if(origViewBox == null){
        console.warn("SVG Navigator: warning: SVG had no viewbox attribute. Making new viewbox attribute.");
        // preferably, we want to set the viewbox as the bounding box values of the SVG from getBBox();
        // unfortunatley, chrome's getBBox() is bugged for some SVG documents, ex: http://upload.wikimedia.org/wikipedia/commons/d/dc/USA_orthographic.svg
        // so we make the viewbox at 0,0 with width and height of client browser
        var format = formatViewBox(0, 0, origSVGWidth, origSVGHeight);
        
        svgDocument.setAttribute("viewBox", format);
        //        fillViewBoxToScreen();
        //        origViewBox = svgDocument.getAttribute("viewBox");
    }
    fillViewBoxToScreen();
    origViewBox = svgDocument.getAttribute("viewBox");
    //    var newViewBox = svgDocument.getAttribute("viewBox");
    
    // global variables for zooming
    var zoomAction = false;
    var zoomX1 = 0;
    var zoomY1 = 0;
    var zoomX2 = 0;
    var zoomY2 = 0;
    var zoomWidth = 0;
    var zoomHeight = 0;
    var zoomRectangle = insertZoomRect();
    
    // global variables for panning
    var panStart_Spacebar = true; // TODO try to not need these separate variables
    var panAction_Spacebar = false; // TODO try to not need these separate variables
    var panStart_Mouse = true; // TODO try to not need these separate variables
    var panAction_Mouse = false; // TODO try to not need these separate variables
    var panViewBoxX = 0;
    var panViewBoxY = 0;
    var panViewBoxWidth = 0;
    var panViewBoxHeight = 0;
    var panOldX = 0;
    var panOldY = 0;
    var panNewX = 0;
    var panNewY = 0;
    //    var newViewBoxX = 0;
    //    var newViewBoxY = 0;
	
	// global settings, defaults
	var clickAndDragBehavior = SVGNavigatorDefaultSettings.clickAndDragBehavior;
	var scrollSensitivity = SVGNavigatorDefaultSettings.scrollSensitivity;
	var invertScroll = SVGNavigatorDefaultSettings.invertScroll;
	var showDebugInfo = SVGNavigatorDefaultSettings.showDebugInfo;    
    
    // for debugging
    var debugTextElement;
    var debugBoundingBox;
    var debugChildren = [];
    var debugMode = showDebugInfo;
    var mouseEvent = {clientX:0, clientY:0};
    
    addEventListeners();
    
    disableSelection();
    
    // add the toolbar
    var toolbarContainer = htmlDoc.createElement("div");
    toolbarContainer.className = "toolbarcontainer";
    
    var toolbarDiv = htmlDoc.createElement("div");
    toolbarDiv.className = "toolbar";
    toolbarContainer.appendChild(toolbarDiv);

    var plusButton = htmlDoc.createElement("div");
    plusButton.innerHTML = "+";
    plusButton.className = "toolbarbutton toolbarbuttonborder"
    plusButton.onclick = function(evt){
        zoomBy(0.8);
    }
    toolbarDiv.appendChild(plusButton);

    var minusButton = htmlDoc.createElement("div");
    minusButton.innerHTML = "-";
    minusButton.className = "toolbarbutton toolbarbuttonborder"
    minusButton.onclick = function(evt){
        zoomOut(true);
    }
    toolbarDiv.appendChild(minusButton);
    
    var resetButton = htmlDoc.createElement("div");
    resetButton.innerHTML = "Reset";
    resetButton.className = "toolbarbutton"
    resetButton.onclick = function(evt){
        zoomOriginal(true)
    }
    toolbarDiv.appendChild(resetButton);
    
    document.body.appendChild(toolbarContainer); // add to DOM
    
    // make the toolbar fadeout after 5 seconds
    toolbarContainer.style.opacity = 1;
    setTimeout(function(){
        toolbarContainer.style.opacity = null;
    }, 5000);
}

// insert a rectangle object into the svg, acting as the zoom rectangle
function insertZoomRect(){
    var zoomRectangle = document.createElementNS(svgNS, "rect");
    zoomRectangle.setAttributeNS(null, "x", 0);
    zoomRectangle.setAttributeNS(null, "y", 0);
    zoomRectangle.setAttributeNS(null, "rx", 0.01);
    zoomRectangle.setAttributeNS(null, "width", 0);
    zoomRectangle.setAttributeNS(null, "height", 0);
    zoomRectangle.setAttributeNS(null, "opacity", 1);
    zoomRectangle.setAttributeNS(null, "stroke", "blue");
    zoomRectangle.setAttributeNS(null, "stroke-width", 1.0);
    zoomRectangle.setAttributeNS(null, "fill", "blue");
    zoomRectangle.setAttributeNS(null, "fill-opacity", 0.1);
    svgDocument.appendChild(zoomRectangle);
    return zoomRectangle;
}

function addEventListeners(){
    // event listeners
    svgDocument.addEventListener("keydown", panBegin, false); // spacebar panning
    svgDocument.addEventListener("mousemove", panMove, false); // spacebar panning
    svgDocument.addEventListener("keyup", panEnd, false); // spacebar panning
    svgDocument.addEventListener("keyup", zoomOut, false); // alt key zoom out
    svgDocument.addEventListener("keyup", zoomOriginal, false); // escape key zoom out
	// retrieve options from stored settings
	chrome.extension.sendRequest("localStorage",
	function(response){
		// settings were stored as JSON in store.js
		try{
			var clickAndDragBehavior = JSON.parse(response["store.settings.clickAndDragBehavior"]);
			if(clickAndDragBehavior == "pan"){
				svgDocument.addEventListener("mousedown", panBegin2, false); // mouse panning
				svgDocument.addEventListener("mousemove", panMove2, false); // mouse panning
				svgDocument.addEventListener("mouseup", panEnd2, false); // mouse panning
			} else if(clickAndDragBehavior == "zoomBox"){
				svgDocument.addEventListener("mousedown", zoomMouseDown, false); // zoom box
				svgDocument.addEventListener("mousemove", zoomMouseMove, false); // zoom box
				svgDocument.addEventListener("mouseup", zoomMouseUp, false); // zoom box
			} else { // default to mouse panning									
				svgDocument.addEventListener("mousedown", panBegin2, false); // mouse panning
				svgDocument.addEventListener("mousemove", panMove2, false); // mouse panning
				svgDocument.addEventListener("mouseup", panEnd2, false); // mouse panning
			}
		} catch(e){
			// default to mouse panning
			svgDocument.addEventListener("mousedown", panBegin2, false); // mouse panning
			svgDocument.addEventListener("mousemove", panMove2, false); // mouse panning
			svgDocument.addEventListener("mouseup", panEnd2, false); // mouse panning
		}
		
		try{
			scrollSensitivity = JSON.parse(response["store.settings.scrollSensitivity"]);
			invertScroll = JSON.parse(response["store.settings.invertScroll"]);
		    svgDocument.addEventListener("mousewheel", doScroll, false); // scroll zooming
		} catch(e){
			// with defaults
		    svgDocument.addEventListener("mousewheel", doScroll, false); // scroll zooming
		}

		try{
			debugMode = JSON.parse(response["store.settings.showDebugInfo"]);
		    if(debugMode){
		        svgDocument.addEventListener("mousemove", mouseMoveEvent, false);
		    }
		    printDebugInfo();
		} catch(e){
			// with defaults
		    printDebugInfo();
		}
	});
}

/* Zoom Functions */
// click and drag to zoom in
// press escape to zoom out
function zoomMouseDown(evt) {
	//if the left click is down and the control and shift keys are NOT depressed, sets top left of zoombox and flag
    if(!(panAction_Spacebar || panAction_Mouse) && zoomRectangle && !evt.ctrlKey && !evt.shiftKey) { // zoom
        zoomAction = true;
        var p = svgDocElement.createSVGPoint();
        p.x = evt.clientX;
        p.y = evt.clientY;
        
        var m = zoomRectangle.getScreenCTM();
        p = p.matrixTransform(m.inverse());
        zoomRectangle.setAttribute("x", p.x);
        zoomRectangle.setAttribute("y", p.y);
        zoomX1 = p.x;
        zoomY1 = p.y;
        
        // re-set zoom rectangle stroke width
        var strokeWidth = 1;
        
        var tokens  = svgDocument.getAttribute("viewBox");
        var token = tokens.split(" ");
        var viewBoxWidth = parseFloat(token[2]);
        var viewBoxHeight = parseFloat(token[3]);
        var viewBoxAspectRatio = viewBoxWidth/viewBoxHeight;
        
        var clientWidth = getWidth();
        var clientHeight = getHeight();
        var clientAspectRatio = clientWidth/clientHeight;
        
        if(viewBoxAspectRatio < clientAspectRatio){
            viewBoxWidth = viewBoxHeight*clientAspectRatio;
        }
        var relativeStrokeWidth = viewBoxWidth/clientWidth;
        
        zoomRectangle.setAttributeNS(null, "stroke-width", relativeStrokeWidth);
        zoomRectangle.setAttributeNS(null, "rx", relativeStrokeWidth);
    }
}

// blue zoombox drawn as mouse is moved across screen
function zoomMouseMove(evt) {
    if(zoomAction) {
        var p = svgDocElement.createSVGPoint();
        p.x = evt.clientX;
        p.y = evt.clientY;
        
        var m = zoomRectangle.getScreenCTM();
        p = p.matrixTransform(m.inverse());
        
        zoomX2 = p.x;
        zoomY2 = p.y;
        zoomWidth=Math.abs(zoomX2 - zoomX1)
        zoomHeight=Math.abs(zoomY2 - zoomY1)
        
        // set top left corner point of zoom rectangle
        zoomX1 < zoomX2 ? zoomRectangle.setAttribute("x", zoomX1) : zoomRectangle.setAttribute("x", zoomX2);
        zoomY1 < zoomY2 ? zoomRectangle.setAttribute("y", zoomY1) : zoomRectangle.setAttribute("y", zoomY2);
        
        zoomRectangle.setAttribute("width", zoomWidth);
        zoomRectangle.setAttribute("height", zoomHeight);
    }
}

// function that completes zoombox, then zooms view to zoombox
function zoomMouseUp(evt) {
	// the viewbox width and height is changed when the button is up
    if(zoomAction){
        var zoomRectWidth = zoomRectangle.getAttribute("width");
        var zoomRectHeight = zoomRectangle.getAttribute("height");
        if((parseFloat(zoomRectWidth)*parseFloat(zoomRectHeight)) > 1e-6){ // prevent zooming on tiny area; svg visual starts acting weird
            // make aspect ratio of new viewbox match the screen aspect ratio; useful later, when adding debug info to corner of screen
            var zoomRectX = zoomRectangle.getAttribute("x");
            var zoomRectY = zoomRectangle.getAttribute("y");
            
            var viewBoxX = zoomRectX;
            var viewBoxY = zoomRectY;
            var viewBoxWidth = zoomRectWidth;
            var viewBoxHeight = zoomRectHeight;
            var viewBoxAspectRatio = viewBoxWidth/viewBoxHeight;
            
            var clientWidth = getWidth();
            var clientHeight = getHeight();
            var clientAspectRatio = clientWidth/clientHeight;
            
            if(viewBoxAspectRatio < clientAspectRatio){
                viewBoxWidth = viewBoxHeight*clientAspectRatio;
                viewBoxX = zoomRectX - (viewBoxWidth-zoomRectWidth)/2;
            } else {
                viewBoxHeight = viewBoxWidth/clientAspectRatio;
                viewBoxY = zoomRectY - (viewBoxHeight-zoomRectHeight)/2;
            }
            
            var format = formatViewBox(viewBoxX, viewBoxY, viewBoxWidth, viewBoxHeight);
            
            svgDocument.setAttribute("viewBox", format);
            printDebugInfo();
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
    if(!zoomAction && !(panAction_Spacebar || panAction_Mouse) && evt.type == "keyup" || evt === true){
        if (evt.charCode) {
            var charCode = evt.charCode;
        } else {
            var charCode = evt.keyCode;
        }
        
        // alt key
        if (charCode == 18 || evt === true) {
            zoomBy(1.25)
        }
    }
}

// positive for zoom out, neg else
function zoomBy(zoomAmount){
    var newViewBox = svgDocument.getAttribute("viewBox");
    var tokens = newViewBox;
    var token = tokens.split(" ");
    var viewBoxX = parseFloat(token[0]);
    var viewBoxY = parseFloat(token[1]);
    var viewBoxWidth = parseFloat(token[2]);
    var viewBoxHeight = parseFloat(token[3]);
    
    var viewBoxCenterX = viewBoxX + viewBoxWidth/2;
    var viewBoxCenterY = viewBoxY + viewBoxHeight/2;
    
    // algorithm to zoom in and gravitate towards cursor scroll
    var newViewBoxWidth = viewBoxWidth*zoomAmount;
    var newViewBoxHeight = viewBoxHeight*zoomAmount;
    
    var midX = viewBoxWidth/2 + viewBoxX;
    var midY = viewBoxHeight/2 + viewBoxY;
    // these should always turn out positive, because client cursor must be within svg x to x+width and y to y+height
    var fracOfSVGX = (midX - viewBoxX)/viewBoxWidth;
    var fracOfSVGY = (midY - viewBoxY)/viewBoxHeight;
    
    var leftWidth = fracOfSVGX*newViewBoxWidth; // offset to new x
    var upperHeight = fracOfSVGY*newViewBoxHeight; // offset to new y
    
    var newViewBoxX = midX - leftWidth;
    var newViewBoxY = midY - upperHeight;
    
    // make new viewbox and insert it into the svg
    var format = formatViewBox(newViewBoxX, newViewBoxY, newViewBoxWidth, newViewBoxHeight);
    svgDocument.setAttribute("viewBox", format);
    printDebugInfo();
}

// zoom back to original view when escape button is clicked
function zoomOriginal(evt){
    if(!zoomAction && !(panAction_Spacebar || panAction_Mouse) && evt.type == "keyup" || evt === true){
        var charCode = evt.charCode || evt.keyCode;
        
        // escape key
        if (charCode == 27 || evt === true) {
            var format =  origViewBox;
            svgDocument.setAttribute("viewBox", origViewBox);
            printDebugInfo();
        }
    }
}

function panBegin(evt){
    if(!panAction_Mouse && !zoomAction && evt.type == "keydown"){
        if (evt.charCode) {
            var charCode = evt.charCode;
        } else {
            var charCode = evt.keyCode;
        }
        
        // spacebar
        if (charCode == 32 && panStart_Spacebar == true) {
            //alert("start");
            panStart_Spacebar = true;
            panAction_Spacebar = true;
            svgDocument.style.cursor='move';
        }
    }
}

// pan with mouse down
function panBegin2(evt){
    if(!panAction_Spacebar && !zoomAction){
        panStart_Mouse = true;
        panAction_Mouse = true;
        svgDocument.style.cursor='move';
    }
}


function panMove(evt) {
    if(panStart_Spacebar && panAction_Spacebar){
        panAction_Spacebar = true;
        panStart_Spacebar = false;
        var p = svgDocElement.createSVGPoint();
        p.x = evt.clientX;
        p.y = evt.clientY;
        var m = svgDocument.getScreenCTM();
        p = p.matrixTransform(m.inverse());
        
        panOldX = p.x;
        panOldY = p.y;
        
        var newViewBox = svgDocument.getAttribute("viewBox");
        
        var tokens = newViewBox;
        var token = tokens.split(" ");
        panViewBoxX = parseFloat(token[0]);
        panViewBoxY = parseFloat(token[1]);
        panViewBoxWidth = parseFloat(token[2]);
        panViewBoxHeight = parseFloat(token[3]);
    }
    if(panAction_Spacebar && !panStart_Spacebar) {
        var p = svgDocElement.createSVGPoint();
        p.x = evt.clientX;
        p.y = evt.clientY;
        var m = svgDocument.getScreenCTM();
        p = p.matrixTransform(m.inverse());
        
        panNewX = p.x;
        panNewY = p.y;
        
        var newViewBox = svgDocument.getAttribute("viewBox");
        
        var tokens = newViewBox;
        var token = tokens.split(" ");
        panViewBoxX = parseFloat(token[0]);
        panViewBoxY = parseFloat(token[1]);
        panViewBoxWidth = parseFloat(token[2]);
        panViewBoxHeight = parseFloat(token[3]);
        
        var newViewBoxX = parseFloat(panViewBoxX - (panNewX - panOldX));
        var newViewBoxY = parseFloat(panViewBoxY - (panNewY - panOldY));
        
        var format = formatViewBox(newViewBoxX, newViewBoxY, panViewBoxWidth, panViewBoxHeight);
        svgDocument.setAttribute("viewBox", format);
        printDebugInfo();
    }
}

// pan with mouse down
function panMove2(evt) {
    if(panStart_Mouse && panAction_Mouse){
        panAction_Mouse = true;
        panStart_Mouse = false;
        var p = svgDocElement.createSVGPoint();
        p.x = evt.clientX;
        p.y = evt.clientY;
        var m = svgDocument.getScreenCTM();
        p = p.matrixTransform(m.inverse());
        
        panOldX = p.x;
        panOldY = p.y;
        
        var newViewBox = svgDocument.getAttribute("viewBox");
        
        var tokens = newViewBox;
        var token = tokens.split(" ");
        panViewBoxX = parseFloat(token[0]);
        panViewBoxY = parseFloat(token[1]);
        panViewBoxWidth = parseFloat(token[2]);
        panViewBoxHeight = parseFloat(token[3]);
    }
    if(panAction_Mouse && !panStart_Mouse) {
        var p = svgDocElement.createSVGPoint();
        p.x = evt.clientX;
        p.y = evt.clientY;
        var m = svgDocument.getScreenCTM();
        p = p.matrixTransform(m.inverse());
        
        panNewX = p.x;
        panNewY = p.y;
        
        var newViewBox = svgDocument.getAttribute("viewBox");
        
        var tokens = newViewBox;
        var token = tokens.split(" ");
        panViewBoxX = parseFloat(token[0]);
        panViewBoxY = parseFloat(token[1]);
        panViewBoxWidth = parseFloat(token[2]);
        panViewBoxHeight = parseFloat(token[3]);
        
        var newViewBoxX = parseFloat(panViewBoxX - (panNewX - panOldX));
        var newViewBoxY = parseFloat(panViewBoxY - (panNewY - panOldY));
        
        var format = formatViewBox(newViewBoxX, newViewBoxY, panViewBoxWidth, panViewBoxHeight);
        svgDocument.setAttribute("viewBox", format);
        printDebugInfo();
    }
}


function panEnd(evt){
    if(panAction_Spacebar && !panStart_Spacebar && evt.type == "keyup"){
        if (evt.charCode) {
            var charCode = evt.charCode;
        } else {
            var charCode = evt.keyCode;
        }
        
        // spacebar
        if (charCode == 32) {
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
            panStart_Spacebar = true;
            panAction_Spacebar = false;
        }
    }
}

// pan with mouse down
function panEnd2(evt){
    if(panAction_Mouse && !panStart_Mouse) {
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
            panStart_Mouse = true;
            panAction_Mouse = false;
    }
}

// implementation for scroll zooming
// the area pointed to by the cursor will always stay under the cursor while scrolling/zooming in or out, just like google maps does
// might be different scroll direction on Macs with "natural scroll" vs Windows
function doScroll(evt){
    if(!zoomAction && !(panAction_Spacebar || panAction_Mouse)){
        evt.preventDefault(); // prevent default scroll action in chrome

		var maxWheelDelta = 1200; // ad hoc limit
		var wheelDelta = evt.wheelDelta;
		var wheelDeltaNormalized = wheelDelta/maxWheelDelta; // [-1, 1]
		if(wheelDeltaNormalized > 1){
			wheelDeltaNormalized = 1;			
		} else if(wheelDeltaNormalized < -1){
			wheelDeltaNormalized = -1;
		}
        
        var scrollAmount = wheelDeltaNormalized * scrollSensitivity * (invertScroll ? -1 : 1); // neg scroll in; pos scroll out; [-scrollSensitivity, scrollSensitivity]
		var maxScrollSensitivity = 10; // check this matches the manifest.js max for scrollSensitivity
		var scrollAmountNormalized = scrollAmount/maxScrollSensitivity; // [-1, 1]
        // scrolling in makes viewbox smaller, so zoomAmount is smaller
        var zoomAmount = scrollAmountNormalized < 0 ? 1 + (-scrollAmountNormalized + 0.01) : 1 / (1 + (scrollAmountNormalized + 0.01)) ; // zoom out : zoom in; (1, 2) : (0, 0.5)
        var p = svgDocElement.createSVGPoint();
        p.x = evt.clientX;
        p.y = evt.clientY;
        
        var m = svgDocument.getScreenCTM();
        p = p.matrixTransform(m.inverse());
        
        var token = svgDocument.getAttribute("viewBox").split(" ");
        var viewBoxX = parseFloat(token[0]);
        var viewBoxY = parseFloat(token[1]);
        var viewBoxWidth = parseFloat(token[2]);
        var viewBoxHeight = parseFloat(token[3]);

        // algorithm to zoom in and gravitate towards cursor scroll
        var newViewBoxWidth = viewBoxWidth*zoomAmount;
        var newViewBoxHeight = viewBoxHeight*zoomAmount;
        
        // these should always turn out positive and between 0 and 1.0, because client cursor must be within svg x to x+width and y to y+height
        var fracOfSVGX = (p.x - viewBoxX)/viewBoxWidth;
        var fracOfSVGY = (p.y - viewBoxY)/viewBoxHeight;
        
        var leftWidth = fracOfSVGX*newViewBoxWidth; // offset to new x
        var upperHeight = fracOfSVGY*newViewBoxHeight; // offset to new y
        
        var newViewBoxX = p.x - leftWidth;
        var newViewBoxY = p.y - upperHeight;
        
        // make new viewbox and insert it into the svg
        var format = formatViewBox(newViewBoxX, newViewBoxY, newViewBoxWidth, newViewBoxHeight);
        svgDocument.setAttribute("viewBox", format);
        printDebugInfo();
    }
}

// function to get the height of the window containing the svg in pixels; this is not the same as the svg viewbox or screen resolution
function getHeight() {
    return self.innerHeight;
}

// function to get the width of the window containing the svg in pixels; this is not the same as the svg viewbox or screen resolution
function getWidth() {
    return self.innerWidth;
}


// to prevent selection of text; prevent text Ibar cursor when dragging
function disableSelection(){
    document.onselectstart = function(){return false}
    document.body.style.cursor = "default"
}

// make aspect ratio of new viewbox match the screen aspect ratio; useful later, when adding debug info to corner of screen
function fillViewBoxToScreen(){
    var newViewBox = svgDocument.getAttribute("viewBox");
    var tokens = newViewBox;
    var token = tokens.split(" ");
    var viewBoxX = parseFloat(token[0]);
    var viewBoxY = parseFloat(token[1]);
    var viewBoxWidth = parseFloat(token[2]);
    var viewBoxHeight = parseFloat(token[3]);
    
    var newViewBoxX = viewBoxX;
    var newViewBoxY = viewBoxY;
    var newViewBoxWidth = viewBoxWidth;
    var newViewBoxHeight = viewBoxHeight;
    
    var viewBoxAspectRatio = viewBoxWidth/viewBoxHeight;
    
    var clientWidth = getWidth();
    var clientHeight = getHeight();
    var clientAspectRatio = clientWidth/clientHeight;
    
    if(viewBoxAspectRatio < clientAspectRatio){
        newViewBoxWidth = viewBoxHeight*clientAspectRatio;
        newViewBoxX = viewBoxX - (newViewBoxWidth - viewBoxWidth)/2;
    } else {
        newViewBoxHeight = viewBoxWidth/clientAspectRatio;
        newViewBoxY = viewBoxY - (newViewBoxHeight - viewBoxHeight)/2;
    }
    var format = formatViewBox(newViewBoxX, newViewBoxY, newViewBoxWidth, newViewBoxHeight);
    
    svgDocument.setAttribute("viewBox", format);
}

function mouseMoveEvent(evt){
    mouseEvent = evt;
    printDebugInfo();
}

function printDebugInfo(){
    if(debugMode){
        var viewBox = svgDocument.getAttribute("viewBox");
        var tokens = viewBox;
        var token = tokens.split(" ");
        var viewBoxX = parseFloat(token[0]);
        var viewBoxY = parseFloat(token[1]);
        var viewBoxWidth = parseFloat(token[2]);
        var viewBoxHeight = parseFloat(token[3]);
        
        if(!debugTextElement){
            debugTextElement = htmlDoc.createElement("div");
            var textLines = 9; // number of lines to display in debug info
            for(var count = 0; count < textLines; count++){
                debugChildren[count] = htmlDoc.createElement("div");
				debugChildren[count].style.padding = "1px 3px";
                debugTextElement.appendChild(debugChildren[count]);
            }
			debugTextElement.style.position = "fixed";
			debugTextElement.style.top = "5px";
			debugTextElement.style.left = "5px";
			debugTextElement.style["pointer-events"] = "none";
			debugTextElement.style.padding = "5px";
			debugTextElement.style.background = "rgba(0, 0, 0, 0.8)";
			debugTextElement.style.border = "1px solid #BBB";
			debugTextElement.style["border-radius"] = "5px";
			debugTextElement.style.color = "white";
			debugTextElement.style["font-family"] = "'Lucida Grande', sans-serif";
			
            document.body.appendChild(debugTextElement); // add to DOM
        }
        debugChildren[0].innerHTML = "Debug Info:";
        debugChildren[1].innerHTML = "ViewBox X: " + viewBoxX;
        debugChildren[2].innerHTML = "ViewBox Y: " + viewBoxY;
        debugChildren[3].innerHTML = "ViewBox Width: " + viewBoxWidth;
        debugChildren[4].innerHTML = "ViewBox Height: " + viewBoxHeight;
        debugChildren[5].innerHTML = "CurrentVBW/InitVBW: " + viewBoxWidth/origSVGWidth;
        debugChildren[6].innerHTML = "CurrentVBH/InitVBH: " + viewBoxHeight/origSVGHeight;
        debugChildren[7].innerHTML = "Client X: " + mouseEvent.clientX;
        debugChildren[8].innerHTML = "Client Y: " + mouseEvent.clientY;
    }
}

// helper function to make the viewbox attribute
// ignore error checking for now
function formatViewBox(x, y, width, height){
    return parseFloat(x) + ' ' +
    parseFloat(y) + ' ' +
    parseFloat(width) + ' ' +
    parseFloat(height);
}