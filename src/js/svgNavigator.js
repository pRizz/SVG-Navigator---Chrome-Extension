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

/**
 * svgNavigator.js
 * Contains all the logic for panning, zooming, and other controls.
 */

// TODO: Reduce the need for globals

// define svg namespace
const svgNS = "http://www.w3.org/2000/svg";
var svgDocument;

// wrap the svg document in an html document
var svgDocElement;
var htmlDoc;
var origSVGWidth;
var origSVGHeight;
var originalViewBoxText;
var viewBox;

// global variables for zooming
var zoomAction = false;
var zoomX1 = 0;
var zoomY1 = 0;
var zoomX2 = 0;
var zoomY2 = 0;
var zoomWidth = 0;
var zoomHeight = 0;
var zoomRectangle;

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

// FIXME: options don't have common access to these default settings
const SVGNavigatorDefaultSettings = {
	"clickAndDragBehavior": "pan",
	"scrollSensitivity": 7,
	"invertScroll": false,
	"toolbarAutoHide": true,
	"toolbarEnabled": true,
	"showDebugInfo": false,
	"svgBackgroundColor": "white"
}

// global settings, defaults
var clickAndDragBehavior = SVGNavigatorDefaultSettings.clickAndDragBehavior;
var scrollSensitivity = SVGNavigatorDefaultSettings.scrollSensitivity;
var invertScroll = SVGNavigatorDefaultSettings.invertScroll;
let toolbarAutoHide = SVGNavigatorDefaultSettings.toolbarAutoHide;
let toolbarEnabled = SVGNavigatorDefaultSettings.toolbarEnabled;
var showDebugInfo = SVGNavigatorDefaultSettings.showDebugInfo;
var svgBackgroundColor = SVGNavigatorDefaultSettings.svgBackgroundColor;

// for debugging
var debugTextElement;
var debugChildren = [];
var debugMode = showDebugInfo;
var debugMouseEvent = {
    clientX: 0,
    clientY: 0
};

main().then(() => {
    console.log("SVG Navigator loaded");
});

async function main() {
    "use strict";

    if(!isFileCompatible()) { return }

    // wrap the svg document in an html document
    svgDocElement = document.documentElement;
    htmlDoc = document.implementation.createHTMLDocument();

    document.replaceChild(htmlDoc.documentElement, svgDocElement);

    // the htmlDoc is the new document object
    document.body.appendChild(svgDocElement);
    document.body.style.margin = 0;
    document.body.style['overflow-y'] = 'scroll'

    // document variables
    var svgElements = document.getElementsByTagName("svg");

    svgDocument = svgElements[0];

    if(!svgDocument) {
        console.error("SVG Navigator: No SVG element found");
        return;
    }

    // @since 2.6
    // Remove of the SVG element `style` `width` and `height` in case 
    // these limit the visible SVG area.
    // See `examples/plantuml.html` and `examples/githubsvg.html` for the use case.
    if (svgDocument.getAttribute("style")) {
        // Do not expose const `style` to keep outer scope cleaner.
        // Thus call `svgDocument.getAttribute` twice.
        const style = svgDocument.getAttribute("style");

        // Define regex patterns for width and height separately
        const widthRegex = /(\s*width\s*:\s*[^;]+;\s*)/g;
        const heightRegex = /(\s*height\s*:\s*[^;]+;\s*)/g;

        // Remove 'width' properties from the style attribute
        let newStyle = style.replace(widthRegex, '');

        // Remove 'height' properties from the style attribute
        newStyle = newStyle.replace(heightRegex, '');

        // Update the 'style' attribute of the SVG element with the modified value
        svgDocument.setAttribute("style", newStyle);
    }
    // end @since

    zoomRectangle = insertZoomRect();

    // keep aspect ratio; just remove attribute if it exists
    svgDocument.hasAttribute("preserveAspectRatio") && svgDocument.removeAttribute("preserveAspectRatio");

    // save original svg width and height
    // TODO problematic when width or height contain percent character
    origSVGWidth = parseFloat(svgDocument.getAttribute("width") || getWidth());
    origSVGHeight = parseFloat(svgDocument.getAttribute("height") || getHeight());
    // make width and height 100% to fill client web browser
    svgDocument.setAttribute("width", "100%");
    svgDocument.setAttribute("height", "100%");

    originalViewBoxText = svgDocument.getAttribute("viewBox");
    // check if the svg document had a viewbox
    if(originalViewBoxText == null){
        console.warn("SVG Navigator: warning: SVG had no viewbox attribute. Making new viewbox attribute.");
        // preferably, we want to set the viewbox as the bounding box values of the SVG from getBBox();
        // unfortunatley, chrome's getBBox() is bugged for some SVG documents, ex: http://upload.wikimedia.org/wikipedia/commons/d/dc/USA_orthographic.svg
        // so we make the viewbox at 0,0 with width and height of client browser
        const formattedViewBox = formatViewBox(0, 0, origSVGWidth, origSVGHeight);

        svgDocument.setAttribute("viewBox", formattedViewBox);
    }

    fillViewBoxToScreen();
    originalViewBoxText = svgDocument.getAttribute("viewBox");
    // this variable should always be up to date and set the real viewbox when it changes
    viewBox = parseOrGetViewBox();

    addEventListeners();
    maybeAddToolbar();
    disableSelection();
}

async function getSyncOrDefault(key) {
    const data = await chrome.storage.sync.get(key);
    return data.hasOwnProperty(key) ? data[key] : SVGNavigatorDefaultSettings[key];
}

async function maybeAddToolbar() {
    toolbarAutoHide = await getSyncOrDefault("toolbarAutoHide");
    toolbarEnabled = await getSyncOrDefault("toolbarEnabled");

    if(!toolbarEnabled){
        return;
    }

    var toolbarContainer = htmlDoc.createElement("div");
    toolbarContainer.className = "toolbarcontainer";

    var toolbarDiv = htmlDoc.createElement("div");
    toolbarDiv.className = "toolbar";
    toolbarContainer.appendChild(toolbarDiv);

    var plusButton = htmlDoc.createElement("div");
    plusButton.innerHTML = "+";
    plusButton.className = "toolbarbutton toolbarbuttonborder";
    plusButton.onclick = function(evt){
        zoomBy(0.8);
    };
    toolbarDiv.appendChild(plusButton);

    var minusButton = htmlDoc.createElement("div");
    minusButton.innerHTML = "-";
    minusButton.className = "toolbarbutton toolbarbuttonborder";
    minusButton.onclick = function(evt){
        zoomOut(true);
    };
    toolbarDiv.appendChild(minusButton);

    var resetButton = htmlDoc.createElement("div");
    resetButton.innerHTML = "Reset";
    resetButton.className = "toolbarbutton";
    resetButton.onclick = function(evt){
        zoomOriginal(true)
    };
    toolbarDiv.appendChild(resetButton);

    document.body.appendChild(toolbarContainer); // add to DOM

    // make the toolbar fadeout after 5 seconds
    toolbarContainer.style.opacity = 1;
    if(toolbarAutoHide) {
        setTimeout(function(){
            toolbarContainer.style.opacity = null;
        }, 5000);
    }
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

function getChromeLocalStorage() {
    return new Promise((resolve, reject) => {
        chrome.storage.local.get(null, (result) => {
            if (chrome.runtime.lastError) {
                reject(chrome.runtime.lastError);
            } else {
                resolve(result);
            }
        });
    });
}

chrome.storage.onChanged.addListener((changes, namespace) => {
    console.log("storage changed");
    for (let [key, { oldValue, newValue }] of Object.entries(changes)) {
        console.log(
        `Storage key "${key}" in namespace "${namespace}" changed.`,
        `Old value was "${oldValue}", new value is "${newValue}".`
        );
        if(key == "showDebugInfo"){
            debugMode = showDebugInfo = new Boolean(newValue).valueOf();
            maybePrintDebugInfo();
            document.addEventListener("mousemove", (e) => {
                debugMouseEvent = e;
                maybePrintDebugInfo();
            }, false);
        }
    }
});
console.log("added storage listener");

async function addEventListeners(){
    // event listeners
    document.addEventListener("keydown", panBegin, false); // spacebar panning
    document.addEventListener("mousemove", panMove, false); // spacebar panning
    document.addEventListener("keyup", panEnd, false); // spacebar panning
    document.addEventListener("keyup", zoomOut, false); // alt key zoom out
    document.addEventListener("keyup", zoomOriginal, false); // escape key zoom out
    document.addEventListener("keyup", zoomCtrlKeys, false); // ctrl key zoom in/out
	// retrieve options from stored settings
    try{
        const clickAndDragBehavior = await getSyncOrDefault("clickAndDragBehavior");
        if(clickAndDragBehavior == "pan"){
            svgDocument.addEventListener("mousedown", panBegin2, false); // mouse panning
            document.addEventListener("mousemove", panMove2, false); // mouse panning
            document.addEventListener("mouseup", panEnd2, false); // mouse panning
        } else if(clickAndDragBehavior == "zoomBox"){
            svgDocument.addEventListener("mousedown", zoomMouseDown, false); // zoom box
            svgDocument.addEventListener("mousemove", zoomMouseMove, false); // zoom box
            svgDocument.addEventListener("mouseup", zoomMouseUp, false); // zoom box
        } else { // default to mouse panning
            svgDocument.addEventListener("mousedown", panBegin2, false); // mouse panning
            document.addEventListener("mousemove", panMove2, false); // mouse panning
            document.addEventListener("mouseup", panEnd2, false); // mouse panning
        }
    } catch(e){
        // default to mouse panning
        svgDocument.addEventListener("mousedown", panBegin2, false); // mouse panning
        document.addEventListener("mousemove", panMove2, false); // mouse panning
        document.addEventListener("mouseup", panEnd2, false); // mouse panning
    }

    try{
        scrollSensitivity = await getSyncOrDefault("scrollSensitivity");
        invertScroll = await getSyncOrDefault("invertScroll");
        svgDocument.addEventListener("mousewheel", doScroll, false); // scroll zooming
    } catch(e){
        // with defaults
        svgDocument.addEventListener("mousewheel", doScroll, false); // scroll zooming
    }

    try{
        debugMode = await getSyncOrDefault("showDebugInfo");
        if(debugMode){
            document.addEventListener("mousemove", (e) => {
                debugMouseEvent = e;
                maybePrintDebugInfo();
            }, false);
        }
        maybePrintDebugInfo();
    } catch(e){
        // with defaults
        maybePrintDebugInfo();
    }

    try{
        svgBackgroundColor = await getSyncOrDefault("svgBackgroundColor");
        document.body.style.backgroundColor = svgBackgroundColor;
    } catch(e){
        // with defaults
        document.body.style.backgroundColor = svgBackgroundColor;
    }
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

        var viewBoxWidth = viewBox.width;
        var viewBoxHeight = viewBox.height;
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
        zoomWidth = Math.abs(zoomX2 - zoomX1);
        zoomHeight = Math.abs(zoomY2 - zoomY1);

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

            viewBox.x = zoomRectX;
            viewBox.y = zoomRectY;
            viewBox.width = zoomRectWidth;
            viewBox.height = zoomRectHeight;
            var viewBoxAspectRatio = viewBox.width/viewBox.height;

            var clientAspectRatio = getWidth()/getHeight();

            if(viewBoxAspectRatio < clientAspectRatio){
                viewBox.width = viewBox.height*clientAspectRatio;
                viewBox.x = zoomRectX - (viewBox.width-zoomRectWidth)/2;
            } else {
                viewBox.height = viewBox.width/clientAspectRatio;
                viewBox.y = zoomRectY - (viewBox.height-zoomRectHeight)/2;
            }
            setViewBox();
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
        var charCode = evt.charCode || evt.keyCode;

        // alt key
        if (charCode == 18 || evt === true) {
            zoomBy(1.25)
        }
    }
}

// positive for zoom out, neg else
function zoomBy(zoomAmount){
    var oldViewBoxWidth = viewBox.width;
    var oldViewBoxHeight = viewBox.height;

    // algorithm to zoom in and gravitate towards center
    viewBox.width = viewBox.width * zoomAmount;
    viewBox.height = viewBox.height * zoomAmount;
    var midX = oldViewBoxWidth / 2 + viewBox.x;
    var midY = oldViewBoxHeight / 2 + viewBox.y;

    // these should always turn out positive, because client cursor must be within svg x to x+width and y to y+height
    var fracOfSVGX = (midX - viewBox.x) / oldViewBoxWidth;
    var fracOfSVGY = (midY - viewBox.y) / oldViewBoxHeight;
    var leftWidth = fracOfSVGX * viewBox.width; // offset to new x
    var upperHeight = fracOfSVGY * viewBox.height; // offset to new y
    viewBox.x = midX - leftWidth;
    viewBox.y = midY - upperHeight;
    setViewBox();
}

// zoom back to original view when escape button is clicked or Reset button pressed
function zoomOriginal(evt){
    var charCode = evt.charCode || evt.keyCode;
    if(!zoomAction && !(panAction_Spacebar || panAction_Mouse) && ((evt.type == "keyup" && charCode == 27) || evt === true)){
        viewBox = parseOrGetViewBox(originalViewBoxText);
        setViewBox();
    }
}

// zoom according to ctrl keys
function zoomCtrlKeys(evt){
    if(!zoomAction && !(panAction_Spacebar || panAction_Mouse) && evt.type == "keyup" && evt.ctrlKey){
        var charCode = evt.charCode || evt.keyCode;
        if (charCode == 48) { // ctrl-0, reset zoom
            viewBox = parseOrGetViewBox(originalViewBoxText);
            setViewBox();
        } else if (charCode == 187) { // ctrl-+, zoom in
            zoomBy(0.8)
        } else if (charCode == 189) { // ctrl--, zoom out
            zoomBy(1.25)
        }
    }
}

function panBegin(evt){
    if(!panAction_Mouse && !zoomAction && evt.type == "keydown"){
        var charCode = evt.charCode || evt.keyCode;
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

        panViewBoxX = viewBox.x;
        panViewBoxY = viewBox.y;
        panViewBoxWidth = viewBox.width;
        panViewBoxHeight = viewBox.height;
    }
    if(panAction_Spacebar && !panStart_Spacebar) {
        p = svgDocElement.createSVGPoint();
        p.x = evt.clientX;
        p.y = evt.clientY;
        m = svgDocument.getScreenCTM();
        p = p.matrixTransform(m.inverse());

        panNewX = p.x;
        panNewY = p.y;

        panViewBoxX = viewBox.x;
        panViewBoxY = viewBox.y;
        panViewBoxWidth = viewBox.width;
        panViewBoxHeight = viewBox.height;

        viewBox.x = parseFloat(panViewBoxX - (panNewX - panOldX));
        viewBox.y = parseFloat(panViewBoxY - (panNewY - panOldY));
        setViewBox();
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

        panViewBoxX = viewBox.x;
        panViewBoxY = viewBox.y;
        panViewBoxWidth = viewBox.width;
        panViewBoxHeight = viewBox.height;
    }
    if(panAction_Mouse && !panStart_Mouse) {
        p = svgDocElement.createSVGPoint();
        p.x = evt.clientX;
        p.y = evt.clientY;
        m = svgDocument.getScreenCTM();
        p = p.matrixTransform(m.inverse());

        panNewX = p.x;
        panNewY = p.y;

        panViewBoxX = viewBox.x;
        panViewBoxY = viewBox.y;
        panViewBoxWidth = viewBox.width;
        panViewBoxHeight = viewBox.height;

        viewBox.x = parseFloat(panViewBoxX - (panNewX - panOldX));
        viewBox.y = parseFloat(panViewBoxY - (panNewY - panOldY));
        setViewBox();
    }
}


function panEnd(evt){
    if(evt.type == "keyup"){
        var charCode = evt.charCode || evt.keyCode;
        // spacebar
        if (charCode == 32) {
            svgDocument.style.cursor = 'default';
            panStart_Spacebar = true;
            panAction_Spacebar = false;
        }
    }
}

// pan with mouse down
function panEnd2(evt){
    svgDocument.style.cursor = 'default';
    panStart_Mouse = true;
    panAction_Mouse = false;
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

        // scrollSensitivity and invertScroll are not initialized properly
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

        // algorithm to zoom in and gravitate towards cursor scroll
        var newViewBoxWidth = viewBox.width * zoomAmount;
        var newViewBoxHeight = viewBox.height * zoomAmount;

        // these should always turn out positive and between 0 and 1.0, because client cursor must be within svg x to x+width and y to y+height
        var fracOfSVGX = (p.x - viewBox.x) / viewBox.width;
        var fracOfSVGY = (p.y - viewBox.y) / viewBox.height;

        var leftWidth = fracOfSVGX * newViewBoxWidth; // offset to new x
        var upperHeight = fracOfSVGY * newViewBoxHeight; // offset to new y

        viewBox.x = p.x - leftWidth;
        viewBox.y = p.y - upperHeight;
        viewBox.width = newViewBoxWidth;
        viewBox.height = newViewBoxHeight;
        setViewBox();
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
    document.onselectstart = function(){return false};
    document.body.style.cursor = "default"
}

// make aspect ratio of new viewbox match the screen aspect ratio; useful later, when adding debug info to corner of screen
function fillViewBoxToScreen(){
    var viewBox = parseOrGetViewBox();
    var viewBoxX = viewBox.x;
    var viewBoxY = viewBox.y;
    var viewBoxWidth = viewBox.width;
    var viewBoxHeight = viewBox.height;

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

function maybePrintDebugInfo(){
    if(debugMode){
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
			debugTextElement.style["font-family"] = "'Consolas', 'Lucida Grande', sans-serif";

            document.body.appendChild(debugTextElement); // add to DOM
        }
        debugChildren[0].innerHTML = "Debug Info:";
        debugChildren[1].innerHTML = "ViewBox X: " + viewBox.x;
        debugChildren[2].innerHTML = "ViewBox Y: " + viewBox.y;
        debugChildren[3].innerHTML = "ViewBox Width: " + viewBox.width;
        debugChildren[4].innerHTML = "ViewBox Height: " + viewBox.height;
        debugChildren[5].innerHTML = "CurrentVBW/InitVBW: " + viewBox.width/origSVGWidth;
        debugChildren[6].innerHTML = "CurrentVBH/InitVBH: " + viewBox.height/origSVGHeight;
        debugChildren[7].innerHTML = "Client X: " + debugMouseEvent.clientX;
        debugChildren[8].innerHTML = "Client Y: " + debugMouseEvent.clientY;
    } else {
        if(debugTextElement){
            document.body.removeChild(debugTextElement);
            debugTextElement = null;
        }
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

// helper to parse the viewbox frame
function parseOrGetViewBox(viewBoxText){
    var tokens = viewBoxText && viewBoxText.split(" ") || svgDocument.getAttribute("viewBox").split(" ");
    return {
        x: parseFloat(tokens[0]),
        y: parseFloat(tokens[1]),
        width: parseFloat(tokens[2]),
        height: parseFloat(tokens[3])
    };
}

function setViewBox(){
    svgDocument.setAttribute("viewBox", formatViewBox(viewBox.x, viewBox.y, viewBox.width, viewBox.height));
    maybePrintDebugInfo();
}

function isFileCompatible() {
    const baseURI = (document.rootElement && document.rootElement.baseURI) || undefined
    if (!baseURI) { return false }
    return baseURI.endsWith(".svg") || baseURI.endsWith(".svgz") || 
        // @since 2.6
        // Check id the the actual document content is svg not only by extension.
        isSVGDocument(document)
}

// @since 2.6
function isSVGDocument(document) {
    // Expect the document root to be a svg element.
    const isTopLevelSVG = document.documentElement.tagName.toLowerCase() === "svg"
    
    // Could comfortably  add other edge cases here if needed.
    return isTopLevelSVG
}
