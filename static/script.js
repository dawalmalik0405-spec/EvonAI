const canvas = new fabric.Canvas('whiteboard', {
  
  backgroundColor: '#fff',
  selection: true,
  preserveObjectStacking: true,
  fireRightClick: true,
  stopContextMenu: true,
  selectionKey: 'shiftKey',
  subTargetCheck: true,
  perPixelTargetFind: true,
  // Add these for better performance
  renderOnAddRemove: true,
  skipOffscreen: false,
  // Set willReadFrequently to address the warning
  willReadFrequently: true
});

window.canvas = canvas;

window.canvas = canvas;



canvas.on("object:added", saveState);
canvas.on("object:modified", saveState);
canvas.on("object:removed", saveState);





canvas.getSelectionContext().imageSmoothingEnabled = false;


fabric.Object.prototype.perPixelTargetFind = true;
fabric.Object.prototype.targetFindTolerance = 8;  // easier edge selection




const canvasElement = document.getElementById('whiteboard');
if (canvasElement) {
  const ctx = canvasElement.getContext('2d', { willReadFrequently: true });
}


// ===================== UNDO / REDO SYSTEM =====================
let undoStack = [];
let redoStack = [];

function saveState() {
    redoStack = []; // Clear redo on new action
    undoStack.push(JSON.stringify(canvas.toJSON()));
    if (undoStack.length > 50) undoStack.shift(); // limit history
}

function undo() {
    if (undoStack.length === 0) return;

    redoStack.push(JSON.stringify(canvas.toJSON()));

    const prevState = undoStack.pop();
    canvas.loadFromJSON(prevState, () => canvas.renderAll());
}

function redo() {
    if (redoStack.length === 0) return;

    undoStack.push(JSON.stringify(canvas.toJSON()));

    const nextState = redoStack.pop();
    canvas.loadFromJSON(nextState, () => canvas.renderAll());
}



async function uploadImageToServer(base64) {
    const res = await fetch("/api/upload-image", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ data: base64 })
    });

    const data = await res.json();
    return data.url; // This will be /static/uploads/xxxx.png
}



const urlParams = new URLSearchParams(window.location.search);
let currentProjectId = urlParams.get("project_id") || null;

// State management
let currentTool = 'select';
let currentColor = '#000000';
let fillColor = 'transparent';
let thickness = 2;
let isDrawing = false;
let currentObject = null;
let fontSize = 20;
let polygonPoints = [];
let zoomLevel = 1;
let isToolbarCollapsed = false;
let isPanning = false;
let lastPosX = 0;
let lastPosY = 0;

// Zoom to area state
let isZoomToAreaMode = false;
let zoomAreaRect = null;
// CSS Inspector state
let cssInspector = null;
let currentSelectedObject = null;


function makeObjectResizable(obj) {
    if (!obj) return;


    if (obj.componentId) {
        return;
    }

    obj.set({
        selectable: true,
        hasControls: true,
        hasBorders: true,
        borderColor: '#4e9eff',
        cornerColor: '#ffffff',
        transparentCorners: false,
        padding: 6,
        lockScalingX: false,
        lockScalingY: false,
        lockUniScaling: false,
        lockRotation: false
    });

    canvas.requestRenderAll();
}




// ===================== COPY / PASTE =====================
let clipboard = null;

document.addEventListener("keydown", async (e) => {
    // COPY (Ctrl+C)
    if (e.ctrlKey && e.key === "c") {
        if (canvas.getActiveObject()) {
            canvas.getActiveObject().clone((cloned) => {
                clipboard = cloned;
            });
        }
    }

    // PASTE (Ctrl+V)
    if (e.ctrlKey && e.key === "v") {
        if (clipboard) {
            clipboard.clone((clonedObj) => {
                canvas.discardActiveObject();

                clonedObj.set({
                    left: clonedObj.left + 20,
                    top: clonedObj.top + 20
                });

                canvas.add(clonedObj);
                canvas.setActiveObject(clonedObj);
                canvas.renderAll();
                saveState();
            });
        }
    }
});






//image 
// Replace the extractImagesFromCanvas function in script.js with this:
async function extractImagesFromCanvas() {
    const result = [];
    
    canvas.getObjects().forEach(async (obj, index) => {
        if (obj.type === "image") {
            try {
                // Get the actual image element
                const imgElement = obj._element || obj.getElement();
                if (imgElement) {
                    // Convert to base64 with better quality
                    const MAX_DIM = 512;  // <--- prevent huge images
    
                    let newWidth = obj.width * obj.scaleX;
                    let newHeight = obj.height * obj.scaleY;
    
                    // Resize large images
                    if (newWidth > MAX_DIM || newHeight > MAX_DIM) {
                        const scale = Math.min(MAX_DIM / newWidth, MAX_DIM / newHeight);
                        newWidth = Math.round(newWidth * scale);
                        newHeight = Math.round(newHeight * scale);
                    }
    
                    const tempCanvas = document.createElement('canvas');
                    tempCanvas.width = newWidth;
                    tempCanvas.height = newHeight;
                    const tempCtx = tempCanvas.getContext('2d');
    
                    tempCtx.drawImage(imgElement, 0, 0, newWidth, newHeight);
    
                    // Much smaller output
                    const base64 = tempCanvas.toDataURL('image/jpeg', 0.4); // reduced quality
    
                    
                    result.push({
                        id: `image_${index}`,
                        src: await uploadImageToServer(base64),
                        width: canvas.width,
                        height: canvas.height,
                        type: 'jpg'
                    });
    
                }
            } catch (e) {
                console.warn('Failed to extract image:', e);
            }
        }
    });
zz    
    return result;
}





const HANDLE_SIZE = 10;
const HITBOX_SIZE = 28;

// Figma circle handle renderer
function renderFigmaHandle(ctx, left, top) {
    const s = HANDLE_SIZE;

    ctx.save();
    ctx.beginPath();

    ctx.shadowColor = 'rgba(0,0,0,0.12)';
    ctx.shadowBlur = 3;

    ctx.fillStyle = '#ffffff';
    ctx.arc(left + s/2, top + s/2, s/2, 0, Math.PI*2);
    ctx.fill();

    ctx.shadowBlur = 0;
    ctx.strokeStyle = '#8c8c8c';
    ctx.lineWidth = 1.25;
    ctx.stroke();

    ctx.restore();
}

fabric.Object.prototype.objectCaching = false;
fabric.Object.prototype.cornerSize = 12;   // default 12
fabric.Object.prototype.touchCornerSize = 24;
fabric.Object.prototype.minimumInteractiveArea = HITBOX_SIZE;



// Apply the new controls ONCE
for (const key in fabric.Object.prototype.controls) {
    const ctrl = fabric.Object.prototype.controls[key];
    ctrl.cornerSize = HITBOX_SIZE;      // 28 px hitbox
    ctrl.render = renderFigmaHandle;    // Figma-style handle
}

// Resize cursors
fabric.Object.prototype.controls.tl.cursorStyle = 'nwse-resize';
fabric.Object.prototype.controls.tr.cursorStyle = 'nesw-resize';
fabric.Object.prototype.controls.br.cursorStyle = 'nwse-resize';
fabric.Object.prototype.controls.bl.cursorStyle = 'nesw-resize';

fabric.Object.prototype.controls.ml.cursorStyle = 'ew-resize';
fabric.Object.prototype.controls.mr.cursorStyle = 'ew-resize';
fabric.Object.prototype.controls.mt.cursorStyle = 'ns-resize';
fabric.Object.prototype.controls.mb.cursorStyle = 'ns-resize';

// Rotation handle
fabric.Object.prototype.controls.mtr.cursorStyle = 'grab';
fabric.Object.prototype.controls.mtr.cornerSize = 20;
fabric.Object.prototype.controls.mtr.offsetY = -36;
fabric.Object.prototype.controls.mtr.render = function(ctx, left, top) {
    ctx.save();
    ctx.beginPath();
    ctx.fillStyle = '#1A73E8';
    ctx.arc(left + 10, top + 10, 6, 0, Math.PI*2);
    ctx.fill();
    ctx.restore();
};



let snapLines = [];

function clearSnapLines() {
    snapLines.forEach(l => canvas.remove(l));
    snapLines = [];
}

function drawSnapLine(points) {
    const l = new fabric.Line(points, {
        stroke: '#ff2d55',
        strokeWidth: 1.5,
        selectable: false,
        evented: false
    });
    canvas.add(l);
    snapLines.push(l);
}

const SNAP_DISTANCE = 8;

function nearlyEqual(a, b, dist = SNAP_DISTANCE) {
    return Math.abs(a - b) <= dist;
}

function getBounds(o) {
    const b = o.getBoundingRect(true);
    return {
        left: b.left,
        top: b.top,
        right: b.left + b.width,
        bottom: b.top + b.height,
        cx: b.left + b.width/2,
        cy: b.top + b.height/2
    };
}

function applyFigmaSnapping(target) {
    clearSnapLines();
    const t = getBounds(target);
    let snapX = null, snapY = null;

    canvas.getObjects().forEach(obj => {
        if (obj === target) return;
        const o = getBounds(obj);

        // Vertical guides
        if (nearlyEqual(t.left, o.left)) {
            snapX = o.left;
            drawSnapLine([o.left, 0, o.left, canvas.getHeight()]);
        }
        if (nearlyEqual(t.cx, o.cx)) {
            snapX = o.cx - (t.cx - t.left);
            drawSnapLine([o.cx, 0, o.cx, canvas.getHeight()]);
        }
        if (nearlyEqual(t.right, o.right)) {
            snapX = o.right - (t.right - t.left);
            drawSnapLine([o.right, 0, o.right, canvas.getHeight()]);
        }

        // Horizontal guides
        if (nearlyEqual(t.top, o.top)) {
            snapY = o.top;
            drawSnapLine([0, o.top, canvas.getWidth(), o.top]);
        }
        if (nearlyEqual(t.cy, o.cy)) {
            snapY = o.cy - (t.cy - t.top);
            drawSnapLine([0, o.cy, canvas.getWidth(), o.cy]);
        }
        if (nearlyEqual(t.bottom, o.bottom)) {
            snapY = o.bottom - (t.bottom - t.top);
            drawSnapLine([0, o.bottom, canvas.getWidth(), o.bottom]);
        }
    });

    if (snapX !== null) target.left = snapX;
    if (snapY !== null) target.top = snapY;
}

// ===== Auto-align text inside buttons or containers =====
canvas.on('object:modified', (e) => {
    const target = e.target;
    if (!target) return;

    // Only auto-align if this is YOUR drawing tools' shapes, not components
    if (!target.componentId) return;
 // <---- ADD THIS CHECK
    if (target.type !== 'group') return;

    if (!target._objects) return;

    target._objects.forEach(obj => {
        if (obj.type === 'i-text' || obj.type === 'text') {
            obj.left = (target.width - obj.width) / 2;
            obj.top = (target.height - obj.height) / 2;
            obj.setCoords();
        }
    });

    canvas.requestRenderAll();
});





















// ==================== SIMPLIFIED TOOL ACTIVATION ====================

function activateTool(tool) {
  if (currentTool === 'polygon' && tool !== 'polygon') {
    if (currentObject) {
      canvas.remove(currentObject);
      currentObject = null;
    }
    polygonPoints = [];
  }
  
  if (isZoomToAreaMode && tool !== 'zoomToArea') {
    exitZoomToAreaMode();
  }
  
  currentTool = tool;
  document.querySelectorAll('.tool[data-tool]').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.tool === tool);
  });
  
  if (tool === 'select') {
    canvas.defaultCursor = 'default';
    canvas.selection = true;
    canvas.getObjects().forEach(obj => {
      obj.set({
        selectable: true,
        hasControls: true,
        hasBorders: true
      });
      makeObjectResizable(obj);
    });
  } else if (tool === 'zoomToArea') {
    enterZoomToAreaMode();
    canvas.selection = false;
  } else {
    canvas.defaultCursor = 'crosshair';
    canvas.selection = false;
  }
  
  if (tool !== 'select') {
    canvas.discardActiveObject();
    canvas.requestRenderAll();
  }
  
  const workspace = document.querySelector('.workspace');
  if (workspace) {
    workspace.setAttribute('data-tool', tool);
  }
}

// ==================== CANVAS RESIZE & ZOOM ====================

function resizeCanvas() {
  const sidebar = document.getElementById('sidebar');
  const toolbar = document.getElementById('toolbar');
  const componentPanel = document.getElementById('componentPanel');




  const isSidebarCollapsed = sidebar.classList.contains('collapsed');
  const isToolbarCollapsed = toolbar.classList.contains('collapsed');
  const isComponentCollapsed = componentPanel.classList.contains('collapsed');
  
  const sidebarWidth = isSidebarCollapsed ? 0 : 340;
  const componentWidth = isComponentCollapsed ? 0 : 320;
  const toolbarHeight = isToolbarCollapsed ? 60 : toolbar.offsetHeight;
  
  const availableWidth = window.innerWidth - sidebarWidth - componentWidth - 40;

  const availableHeight = window.innerHeight - toolbarHeight - 40;
  




  const workspace = document.querySelector('.workspace');
    if (workspace) {
        workspace.style.left = `${sidebarWidth + 20}px`;
        workspace.style.right = `${componentWidth + 20}px`;
        workspace.style.top = `${toolbarHeight + 20}px`;
        workspace.style.width = `calc(100vw - ${sidebarWidth + componentWidth + 40}px)`;

    }


  canvas.setWidth(Math.max(availableWidth, 400));
  canvas.setHeight(Math.max(availableHeight, 300));
  
  canvas.calcOffset();
  canvas.requestRenderAll();
  
   
}

resizeCanvas();
window.addEventListener('resize', resizeCanvas);

function zoomCanvas(factor, point) {
  const oldZoom = zoomLevel;
  zoomLevel *= factor;
  zoomLevel = Math.max(0.1, Math.min(zoomLevel, 5));
  
  if (point) {
    const pointBeforeZoom = new fabric.Point(point.x, point.y);
    const pointAfterZoom = new fabric.Point(
      point.x - (point.x - canvas.viewportTransform[4]) * (zoomLevel / oldZoom),
      point.y - (point.y - canvas.viewportTransform[5]) * (zoomLevel / oldZoom)
    );
    
    canvas.viewportTransform[4] += pointBeforeZoom.x - pointAfterZoom.x;
    canvas.viewportTransform[5] += pointBeforeZoom.y - pointAfterZoom.y;
  }
  
  canvas.setZoom(zoomLevel);
  updateZoomDisplay();
  canvas.requestRenderAll();
}

function resetZoom() {
  zoomLevel = 1;
  canvas.setZoom(1);
  canvas.viewportTransform[4] = 0;
  canvas.viewportTransform[5] = 0;
  updateZoomDisplay();
  canvas.requestRenderAll();
}

function updateZoomDisplay() {
  const zoomResetBtn = document.getElementById('zoomReset');
  if (zoomResetBtn) {
    zoomResetBtn.textContent = `${Math.round(zoomLevel * 100)}%`;
  }
}

function startPanning(opt) {
  if (opt.e.shiftKey || opt.e.which === 2) {
    isPanning = true;
    const pointer = canvas.getPointer(opt.e);
    lastPosX = pointer.x;
    lastPosY = pointer.y;
    canvas.defaultCursor = 'grab';
    opt.e.preventDefault();
  }
}

function panCanvas(opt) {
  if (isPanning) {
    const pointer = canvas.getPointer(opt.e);
    const delta = new fabric.Point(pointer.x - lastPosX, pointer.y - lastPosY);
    canvas.relativePan(delta);
    lastPosX = pointer.x;
    lastPosY = pointer.y;
    canvas.requestRenderAll();
  }
}

function stopPanning() {
  isPanning = false;
  if (isZoomToAreaMode) {
    canvas.defaultCursor = 'crosshair';
  } else {
    canvas.defaultCursor = currentTool === 'select' ? 'default' : 'crosshair';
  }
}

function enterZoomToAreaMode() {
  if (isZoomToAreaMode) return;
  isZoomToAreaMode = true;
  
  document.querySelector('.workspace').classList.add('zoom-to-area');
  
  const output = document.getElementById('aiOutput');
  if (output) {
    output.innerHTML = '<div class="loading">🎯 Drag a rectangle to define the zoom area. Release to zoom in gradually.</div>';
  }
}

function exitZoomToAreaMode() {
  if (!isZoomToAreaMode) return;
  isZoomToAreaMode = false;
  
  if (zoomAreaRect) {
    canvas.remove(zoomAreaRect);
    zoomAreaRect = null;
  }
  
  document.querySelector('.workspace').classList.remove('zoom-to-area');
  
  const output = document.getElementById('aiOutput');
  if (output) {
    output.innerHTML = '';
  }
}

function zoomToAreaGradually(area, steps = 10) {
  const canvasWidth = canvas.getWidth();
  const canvasHeight = canvas.getHeight();
  
  const scaleX = canvasWidth / area.width;
  const scaleY = canvasHeight / area.height;
  const targetZoom = Math.min(scaleX, scaleY, 5) * 0.9;
  
  const targetPanX = -area.left * targetZoom + (canvasWidth - area.width * targetZoom) / 2;
  const targetPanY = -area.top * targetZoom + (canvasHeight - area.height * targetZoom) / 2;
  
  const startZoom = zoomLevel;
  const startPanX = canvas.viewportTransform[4];
  const startPanY = canvas.viewportTransform[5];
  
  let currentStep = 0;
  
  function animateZoom() {
    if (currentStep >= steps) {
      zoomLevel = targetZoom;
      canvas.setZoom(zoomLevel);
      canvas.viewportTransform[4] = targetPanX;
      canvas.viewportTransform[5] = targetPanY;
      canvas.requestRenderAll();
      updateZoomDisplay();
      return;
    }
    
    currentStep++;
    const progress = currentStep / steps;
    const easeProgress = 1 - Math.pow(1 - progress, 3);
    
    zoomLevel = startZoom + (targetZoom - startZoom) * easeProgress;
    canvas.setZoom(zoomLevel);
    
    canvas.viewportTransform[4] = startPanX + (targetPanX - startPanX) * easeProgress;
    canvas.viewportTransform[5] = startPanY + (targetPanY - startPanY) * easeProgress;
    
    canvas.requestRenderAll();
    updateZoomDisplay();
    
    requestAnimationFrame(animateZoom);
  }
  
  animateZoom();
}


































// ==================== FIXED CANVAS EVENT HANDLERS ====================

canvas.on('mouse:down', (opt) => {
  if (opt.e.shiftKey || opt.e.which === 2) {
    startPanning(opt);
    return;
  }


  
  const {x, y} = canvas.getPointer(opt.e);
  
  if (isZoomToAreaMode) {
    zoomAreaRect = new fabric.Rect({
      left: x,
      top: y,
      width: 0,
      height: 0,
      fill: 'rgba(78,158,255,0.15)',
      stroke: '#4e9eff',
      strokeWidth: 2,
      strokeDashArray: [5, 5],
      selectable: false,
      evented: false,
      objectCaching: false
    });
    canvas.add(zoomAreaRect);
    canvas.bringToFront(zoomAreaRect);
    isDrawing = true;
    return;
  }
  
  if (currentTool !== 'select') {
    canvas.discardActiveObject();
    canvas.__skipTargetCheck = true;
    canvas.skipTargetFind = true;


    canvas.defaultCursor = 'crosshair';
    canvas.selection = false;
    canvas.requestRenderAll();
    
    opt.e.preventDefault();
    opt.e.stopPropagation();
    opt.e.stopImmediatePropagation();

    
    isDrawing = true;
    
    if (currentTool === 'rectangle') {
      currentObject = new fabric.Rect({
        left: x, top: y, width: 0, height: 0,
        fill: fillColor === '#000000' ? 'transparent' : fillColor, 
        stroke: currentColor, strokeWidth: thickness,
        selectable: false
      });
      canvas.add(currentObject);
    } else if (currentTool === 'circle') {
      currentObject = new fabric.Circle({
        left: x, top: y, radius: 0,
        fill: fillColor === '#000000' ? 'transparent' : fillColor, 
        stroke: currentColor, strokeWidth: thickness,
        selectable: false
      });
      canvas.add(currentObject);
    } else if (currentTool === 'line') {
      currentObject = new fabric.Line([x, y, x, y], {
        stroke: currentColor, strokeWidth: thickness,
        selectable: false
      });
      canvas.add(currentObject);
    } else if (currentTool === 'arrow') {
      const line = new fabric.Line([x, y, x, y], { 
        stroke: currentColor, 
        strokeWidth: thickness,
        selectable: false 
      });
      const triangle = new fabric.Triangle({
        left: x, top: y, width: 10, height: 10,
        fill: currentColor, originX: 'center', originY: 'center',
        selectable: false
      });
      currentObject = new fabric.Group([line, triangle], { 
        subTargetCheck: true,
        selectable: false 
      });
      canvas.add(currentObject);
    } else if (currentTool === 'triangle') {
      currentObject = new fabric.Triangle({
        left: x, top: y, width: 0, height: 0,
        fill: fillColor === '#000000' ? 'transparent' : fillColor, 
        stroke: currentColor, strokeWidth: thickness,
        selectable: false
      });
      canvas.add(currentObject);
    } else if (currentTool === 'text') {
      isDrawing = false;
      const text = new fabric.IText('Click to edit text', {
        left: x, 
        top: y, 
        fill: currentColor, 
        fontSize: fontSize,
        fontFamily: 'Arial, sans-serif',
        selectable: true,
        hasControls: true,
        hasBorders: true,
        editable: true
      });
      
      canvas.add(text);
      canvas.setActiveObject(text);
      makeObjectResizable(text);
      canvas.requestRenderAll();
      
      setTimeout(() => {
        text.enterEditing();
        text.selectAll();
      }, 10);
    } else if (currentTool === 'polygon') {
      polygonPoints.push({x: x, y: y});
      
      if (polygonPoints.length === 1) {
        currentObject = new fabric.Line([x, y, x, y], {
          stroke: currentColor, 
          strokeWidth: thickness,
          selectable: false
        });
        canvas.add(currentObject);
      } else if (polygonPoints.length >= 2) {
        if (currentObject && currentObject.type === 'line') {
          canvas.remove(currentObject);
        }
        
        currentObject = new fabric.Polygon([...polygonPoints], {
          fill: fillColor === '#000000' ? 'transparent' : fillColor,
          stroke: currentColor, 
          strokeWidth: thickness,
          selectable: false,
          objectCaching: false
        });
        canvas.add(currentObject);
      }
      canvas.requestRenderAll();
    }
    
    return;
  }
});

canvas.on('mouse:move', (opt) => {
  if (isPanning) {
    panCanvas(opt);
    return;
  }
  
  if (isZoomToAreaMode && zoomAreaRect && isDrawing) {
    const pointer = canvas.getPointer(opt.e);
    const {x, y} = pointer;
    
    const left = Math.min(zoomAreaRect.left, x);
    const top = Math.min(zoomAreaRect.top, y);
    const width = Math.abs(x - zoomAreaRect.left);
    const height = Math.abs(y - zoomAreaRect.top);
    
    zoomAreaRect.set({ left, top, width, height });
    canvas.requestRenderAll();
    return;
  }
  
  if (!isDrawing || !currentObject) return;
  
  const {x, y} = canvas.getPointer(opt.e);
  
  if (currentTool === 'rectangle') {
    currentObject.set({
      width: Math.max(1, x - currentObject.left),
      height: Math.max(1, y - currentObject.top)
    });
  } else if (currentTool === 'circle') {
    const radius = Math.max(1, Math.sqrt(Math.pow(x - currentObject.left, 2) + Math.pow(y - currentObject.top, 2)));
    currentObject.set({ radius: radius });
  } else if (currentTool === 'line') {
    currentObject.set({ x2: x, y2: y });
  } else if (currentTool === 'arrow') {
    const line = currentObject.item(0);
    line.set({ x2: x, y2: y });
    
    const triangle = currentObject.item(1);
    const angle = Math.atan2(y - line.y1, x - line.x1) * 180 / Math.PI;
    triangle.set({
      left: x,
      top: y,
      angle: angle
    });
  } else if (currentTool === 'triangle') {
    currentObject.set({
      width: Math.abs(x - currentObject.left) * 2,
      height: Math.abs(y - currentObject.top) * 2
    });
  } else if (currentTool === 'polygon' && polygonPoints.length > 0) {
    if (currentObject && currentObject.type === 'polygon') {
      const points = [...polygonPoints];
      points[points.length - 1] = {x: x, y: y};
      currentObject.set('points', points);
    } else if (currentObject && currentObject.type === 'line') {
      currentObject.set({ x2: x, y2: y });
    }
  }
  
  canvas.requestRenderAll();
});

canvas.on('mouse:up', (opt) => {
  canvas.__skipTargetCheck = false;
  canvas.skipTargetFind = false;

  if (isPanning) {
    canvas.selection = true;
    stopPanning();
    return;
  }
  
  if (isZoomToAreaMode && zoomAreaRect) {
    const area = zoomAreaRect.getBoundingRect();
    
    canvas.remove(zoomAreaRect);
    zoomAreaRect = null;
    isDrawing = false;
    
    if (area.width < 5 || area.height < 5) {
      exitZoomToAreaMode();
      activateTool('select');
      return;
    }
    
    zoomToAreaGradually(area, 15);
    exitZoomToAreaMode();
    activateTool('select');
    
    const output = document.getElementById('aiOutput');
    if (output) {
      output.innerHTML = `<div class="success-message">🔍 Zooming to selected area...</div>`;
      setTimeout(() => output.innerHTML = '', 3000);
    }
    
    return;
  }
  
  if (currentTool !== 'polygon' && currentTool !== 'text') {
    if (currentObject) {
      currentObject.set({
        selectable: true,
        hasControls: true,
        hasBorders: true
      });
      makeObjectResizable(currentObject);
    }
    isDrawing = false;
    currentObject = null;
  }
});

canvas.on('mouse:wheel', function (opt) {
  const delta = opt.e.deltaY;
  let zoom = canvas.getZoom();

  const zoomFactor = 1.1;
  zoom *= delta > 0 ? 1 / zoomFactor : zoomFactor;
  zoom = Math.max(0.1, Math.min(zoom, 10));

  const pointer = new fabric.Point(opt.e.offsetX, opt.e.offsetY);
  canvas.zoomToPoint(pointer, zoom);

  const vpt = canvas.viewportTransform;
  if (vpt[4] >= 0) vpt[4] = 0;
  if (vpt[5] >= 0) vpt[5] = 0;

  const canvasWidth = canvas.getWidth();
  const canvasHeight = canvas.getHeight();
  const zoomedWidth = canvasWidth * zoom;
  const zoomedHeight = canvasHeight * zoom;

  if (zoomedWidth - canvasWidth + vpt[4] < 0) vpt[4] = canvasWidth - zoomedWidth;
  if (zoomedHeight - canvasHeight + vpt[5] < 0) vpt[5] = canvasHeight - zoomedHeight;

  canvas.setViewportTransform(vpt);
  updateZoomDisplay();

  opt.e.preventDefault();
  opt.e.stopPropagation();
});

// ==================== FIXED OBJECT SELECTION EVENTS ====================

canvas.on('selection:created', function(opt) {
  opt.selected.forEach(obj => {
    if (!obj.componentId) {
            makeObjectResizable(obj);
    }
  });
});

canvas.on('selection:updated', function(opt) {
  opt.selected.forEach(obj => {
    if (!obj.componentId) {
            makeObjectResizable(obj);
    }
  });
});



    canvas.on('object:added', function (opt) {
    const obj = opt.target;


    if (obj.componentId) {
        return;
    }


    // Don't override coordinates here!
    if (typeof makeObjectResizable === 'function') {
        makeObjectResizable(obj);
    }
});



// ==================== FIXED DOUBLE-CLICK TEXT EDITING ====================

canvas.on('mouse:dblclick', function (opt) {
    const obj = opt.target;
    if (!obj) return;

    if (obj.type === 'i-text' || obj.type === 'text') {
        obj.set({
            editable: true,
            selectable: true,
            hasControls: true
        });

        canvas.setActiveObject(obj);
        obj.enterEditing();
        obj.selectAll();
        canvas.requestRenderAll();
    }
});



























// ==================== ENHANCED DESIGN DATA EXTRACTION ====================

function extractDesignData() {
    const objects = canvas.getObjects();
    
    const designAnalysis = {
        canvas: {
            width: canvas.getWidth(),
            height: canvas.getHeight(),
            backgroundColor: canvas.backgroundColor
        },
        elements: {
            text: [],
            shapes: [],
            images: [],
            buttons: [],
            containers: []
        },
        layout: {
            rows: [],
            spacing: {},
            alignment: {}
        },
        styles: {
            colors: new Set(),
            fonts: new Set(),
            spacing: {},
            typography: {}
        }
    };

    objects.forEach(obj => {
        const element = extractElementData(obj);
        
        if (obj.type === 'text' || obj.type === 'i-text') {
            designAnalysis.elements.text.push(element);
            analyzeTextStyles(obj, designAnalysis);
        } else if (obj.type === 'rect' || obj.type === 'circle' || obj.type === 'triangle') {
            designAnalysis.elements.shapes.push(element);
            if (isButton(obj, objects)) {
                designAnalysis.elements.buttons.push(element);
            }
            if (isContainer(obj, objects)) {
                designAnalysis.elements.containers.push(element);
            }
        } else if (obj.type === 'image') {
            designAnalysis.elements.images.push(element);
        }
        
        if (obj.fill && obj.fill !== 'transparent') {
            designAnalysis.styles.colors.add(obj.fill);
        }
        if (obj.stroke) {
            designAnalysis.styles.colors.add(obj.stroke);
        }
    });

    analyzeLayout(designAnalysis, objects);
    
    designAnalysis.styles.colors = Array.from(designAnalysis.styles.colors);
    designAnalysis.styles.fonts = Array.from(designAnalysis.styles.fonts);
    
    return designAnalysis;
}

function extractElementData(obj) {
    const baseData = {
        type: obj.type,
        position: {
            left: Math.round(obj.left || 0),
            top: Math.round(obj.top || 0),
            width: Math.round((obj.width || 0) * (obj.scaleX || 1)),
            height: Math.round((obj.height || 0) * (obj.scaleY || 1))
        },
        styles: {}
    };

    switch(obj.type) {
        case 'text':
        case 'i-text':
            baseData.content = obj.text || '';
            baseData.styles = {
                fontSize: obj.fontSize || 16,
                fontFamily: obj.fontFamily || 'Arial',
                fontWeight: obj.fontWeight || 'normal',
                fill: obj.fill || '#000000',
                textAlign: obj.textAlign || 'left'
            };
            break;
            
        case 'rect':
        case 'circle':
        case 'triangle':
            baseData.styles = {
                fill: obj.fill || 'transparent',
                stroke: obj.stroke || 'transparent',
                strokeWidth: obj.strokeWidth || 1,
                borderRadius: obj.rx || 0
            };
            break;
            
        case 'image':
            baseData.styles = {
                opacity: obj.opacity || 1
            };
            break;
    }
    
    return baseData;
}

function isButton(shape, allObjects) {
    const textOnShape = allObjects.find(obj => 
        (obj.type === 'text' || obj.type === 'i-text') && 
        isInsideBounds(obj, shape)
    );
    return !!textOnShape;
}

function isContainer(shape, allObjects) {
    const containedElements = allObjects.filter(obj => 
        obj !== shape && 
        isInsideBounds(obj, shape)
    );
    return containedElements.length > 0;
}

function isInsideBounds(innerObj, containerObj) {
    const innerBounds = innerObj.getBoundingRect();
    const containerBounds = containerObj.getBoundingRect();
    
    return innerBounds.left >= containerBounds.left &&
           innerBounds.top >= containerBounds.top &&
           innerBounds.left + innerBounds.width <= containerBounds.left + containerBounds.width &&
           innerBounds.top + innerBounds.height <= containerBounds.top + containerBounds.height;
}

function analyzeTextStyles(textObj, designAnalysis) {
    if (textObj.fontFamily) {
        designAnalysis.styles.fonts.add(textObj.fontFamily);
    }
    
    const fontSize = textObj.fontSize || 16;
    if (!designAnalysis.styles.typography) {
        designAnalysis.styles.typography = {};
    }
    
    if (fontSize > 32) designAnalysis.styles.typography.h1 = fontSize;
    else if (fontSize > 24) designAnalysis.styles.typography.h2 = fontSize;
    else if (fontSize > 18) designAnalysis.styles.typography.h3 = fontSize;
    else designAnalysis.styles.typography.body = fontSize;
}

function analyzeLayout(designAnalysis, objects) {
    if (objects.length === 0) return;
    
    const rows = [];
    let currentRow = [];
    let lastTop = objects[0].top;
    
    const sortedObjects = [...objects].sort((a, b) => a.top - b.top);
    
    sortedObjects.forEach(obj => {
        if (Math.abs(obj.top - lastTop) < 50) {
            currentRow.push(obj);
        } else {
            if (currentRow.length > 0) rows.push([...currentRow]);
            currentRow = [obj];
        }
        lastTop = obj.top;
    });
    
    if (currentRow.length > 0) rows.push(currentRow);
    
    designAnalysis.layout.rows = rows.map(row => 
        row.map(obj => ({ 
            type: obj.type, 
            left: Math.round(obj.left), 
            width: Math.round((obj.width || 0) * (obj.scaleX || 1)) 
        }))
    );
}

















// function buildGroup(children, opts = {}) {
//   const defaults = {
//     left: opts.left || 0,
//     top: opts.top || 0,
//     selectable: true,
//     subTargetCheck: true,    // allow selecting children inside the group
//     objectCaching: false
//   };
//   // ensure child's coordinates are relative to group (they should already be)
//   const g = new fabric.Group(children, defaults);
//   // make group and children interactive
//   g.getObjects().forEach(obj => {
//     obj.selectable = true;      // allow selecting inside group
//     obj.evented = true;         // allow events to pass through
//     obj.perPixelTargetFind = true;
//   });

//   // enable deep selection inside group
//   g.subTargetCheck = true;
//   g.selectable = true;
//   g.evented = true;

//   // nice default controls for the group
//   makeObjectResizable(g);
//   // Allow independent scaling of children inside groups
//   g.on('scaled', () => {
//       const scaleX = g.scaleX;
//       const scaleY = g.scaleY;

//       g.getObjects().forEach(obj => {
//           obj.scaleX *= scaleX;
//           obj.scaleY *= scaleY;
//           obj.left *= scaleX;
//           obj.top *= scaleY;
//           obj.setCoords();
//       });

//       g.scaleX = 1;
//       g.scaleY = 1;
//       g.setCoords();
//       canvas.requestRenderAll();
//   });

//   return g;


// }



// ===== Auto-layout Frame Detection =====


function detectAutoLayout(group) {
    const children = group._objects;
    if (!children || children.length < 2) return;

    let lastBottom = null;
    let verticalStack = true;

    children.forEach(child => {
        const rect = child.getBoundingRect();
        if (lastBottom !== null && Math.abs(rect.top - lastBottom) > 40) {
            verticalStack = false;
        }
        lastBottom = rect.top + rect.height;
    });

    group.layout = verticalStack ? 'vertical' : 'free';
}

canvas.on('object:modified', e => {
    const g = e.target;
    if (g && g.type === 'group') {
        detectAutoLayout(g);
    }
});

















// safe gradient helper (returns either a gradient object or fallback color)
function safeLinearGradient(coords, stops) {
  try {
    return new fabric.Gradient({
      type: 'linear',
      gradientUnits: 'pixels',
      coords,
      colorStops: stops.map((s, i) => ({ offset: i / (stops.length - 1), color: s }))
    });
  } catch (e) {
    // Fabric version may differ — fall back to solid
    return stops[stops.length - 1] || '#cccccc';
  }
}







fabric.Object.prototype.selectable = true;
fabric.Object.prototype.evented = true;

// Allow deep selection ONLY for groups
fabric.Group.prototype.subTargetCheck = true;



















// ==================== EVENT LISTENERS ====================

document.addEventListener('DOMContentLoaded', function() {
  // Add debug buttons
  const debugDiv = document.createElement('div');
  debugDiv.style.position = 'fixed';
  debugDiv.style.bottom = '10px';
  debugDiv.style.left = '10px';
  debugDiv.style.zIndex = '1000';
  // debugDiv.innerHTML = `
  //   <button onclick="testResize()" style="background: red; color: white; border: none; padding: 5px 10px; margin: 2px; border-radius: 3px;">Test Resize</button>
  //   <button onclick="testText()" style="background: blue; color: white; border: none; padding: 5px 10px; margin: 2px; border-radius: 3px;">Test Text</button>
  // `;
  document.body.appendChild(debugDiv);

  document.querySelectorAll('.tool[data-tool]').forEach(btn => {
    btn.addEventListener('click', () => {
      activateTool(btn.dataset.tool);
    });
  });

  document.getElementById('strokeColorPicker').addEventListener('input', e => {
    currentColor = e.target.value;
    const activeObject = canvas.getActiveObject();
    if (activeObject) {
        // Skip components or handle them specially
        if (activeObject.componentId) {
            // Components handle their own coloring
            return;
        }
        
        if (activeObject.type === 'group') {
            activeObject.getObjects().forEach(o => {
                if (o.stroke !== undefined) {
                    o.set('stroke', currentColor);
                }
            });
            activeObject.addWithUpdate();
        } else {
            activeObject.set('stroke', currentColor);
        }
        canvas.requestRenderAll();
    }
  });

  document.getElementById('fillColorPicker').addEventListener('input', e => {
    fillColor = e.target.value;
    const activeObject = canvas.getActiveObject();
    if (activeObject) {
        if (activeObject.type === 'group') {
            activeObject.getObjects().forEach(o => {
                if (o.type !== 'i-text') {
                    o.set('fill', fillColor === '#000000' ? 'transparent' : fillColor);
                }
            });
            activeObject.addWithUpdate();

        } else {
            if (activeObject.type !== 'i-text')
                activeObject.set('fill', fillColor === '#000000' ? 'transparent' : fillColor);
        }
        canvas.requestRenderAll();
    }

  });

  document.getElementById('thickness').addEventListener('input', e => {
    thickness = +e.target.value;
    const activeObject = canvas.getActiveObject();
    if (activeObject && activeObject.strokeWidth !== undefined) {
      activeObject.set('strokeWidth', thickness);
      canvas.requestRenderAll();
    }
  });

  document.getElementById('fontSize').addEventListener('input', e => {
    fontSize = +e.target.value;
    const activeObject = canvas.getActiveObject();
    if (activeObject && (activeObject.type === 'text' || activeObject.type === 'i-text')) {
      activeObject.set('fontSize', fontSize);
      canvas.requestRenderAll();
    }
  });

  document.getElementById('aiInput').addEventListener('keydown', function(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      document.getElementById('sendPrompt').click();
    }
  });

  const sidebar = document.getElementById('sidebar');
  const toggleSidebar = document.getElementById('toggleSidebar');
  const sidebarHandle = document.getElementById('sidebarHandle');

  function toggleSidebarFunction() {
    sidebar.classList.toggle('collapsed');
    setTimeout(() => {
      resizeCanvas();
    }, 300);
  }

  toggleSidebar.addEventListener('click', toggleSidebarFunction);
  sidebarHandle.addEventListener('click', () => {
    sidebar.classList.remove('collapsed');
    setTimeout(resizeCanvas, 300);
  });

  const toolbar = document.getElementById('toolbar');
  const toggleToolbar = document.getElementById('toggleToolbar');
  
  toggleToolbar.addEventListener('click', () => {
    isToolbarCollapsed = !isToolbarCollapsed;
    if (isToolbarCollapsed) {
      toolbar.classList.add('collapsed');
      toggleToolbar.textContent = '↥';
      toggleToolbar.title = 'Show Toolbar (H)';
    } else {
      toolbar.classList.remove('collapsed');
      toggleToolbar.textContent = '↕️';
      toggleToolbar.title = 'Hide Toolbar (H)';
    }
    setTimeout(resizeCanvas, 300);
  });

  document.getElementById('zoomIn').addEventListener('click', () => {
    const center = {
      x: canvas.getWidth() / 2,
      y: canvas.getHeight() / 2
    };
    zoomCanvas(1.2, center);
  });
  
  document.getElementById('zoomOut').addEventListener('click', () => {
    const center = {
      x: canvas.getWidth() / 2,
      y: canvas.getHeight() / 2
    };
    zoomCanvas(0.8, center);
  });
  
  document.getElementById('zoomReset').addEventListener('click', resetZoom);
  document.getElementById('zoomToArea').addEventListener('click', () => activateTool('zoomToArea'));

  document.getElementById('themeToggle').onclick = () => {
    document.body.classList.toggle('light');
    canvas.setBackgroundColor(document.body.classList.contains('light') ? '#ffffffff' : '#f8f9fa', () => {
      canvas.requestRenderAll();
    });
  };

  document.getElementById('eraser').addEventListener('click', () => {
    const activeObjects = canvas.getActiveObjects();
    if (activeObjects.length > 0) {
      canvas.discardActiveObject();
      canvas.remove(...activeObjects);
      canvas.requestRenderAll();
    } else {
      alert('Select an object first by clicking on it, then use the eraser.');
    }
  });

  document.getElementById('clear').addEventListener('click', () => {
    if (confirm('Clear the entire canvas?')) {
      canvas.clear();
      canvas.setBackgroundColor('#fff', () => canvas.requestRenderAll());
    }
  });






  // === SAVE PROJECT BUTTON ===
const saveProjectBtn = document.getElementById("saveProjectBtn");
if (saveProjectBtn) {
    saveProjectBtn.addEventListener("click", async () => {
        const title = prompt("Enter project name:", "My Project");
        if (!title) return;

        const design = canvas.toJSON();

        const res = await fetch("/api/projects/save", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                project_id: currentProjectId,
                title,
                design
            })
        });

        const data = await res.json();
        if (data.success) {
            alert("Project saved!");
            currentProjectId = data.project_id;
        } else {
            alert("Failed to save project");
        }
    });
}







  document.getElementById('save').addEventListener('click', () => {
    const link = document.createElement('a');
    link.download = `whiteboard-design-${Date.now()}.png`;
    link.href = canvas.toDataURL({format: 'png', multiplier: 2});
    link.click();
  });

  document.getElementById('sendPrompt').addEventListener('click', async () => {
      const prompt = document.getElementById('aiInput').value.trim();
      if (!prompt) {
          alert('Please enter a design request');
          return;
      }



  


      // saveMessage('user', prompt);
      
      const output = document.getElementById('aiOutput');
      output.innerHTML = '<div class="loading">🤖 Analyzing design and generating code...</div>';
      
      try {
          const designAnalysis = extractDesignData();
          const canvasData = canvas.toJSON();
          
          const combinedData = {
              canvas_data: canvasData,
              design_analysis: designAnalysis,
              timestamp: new Date().toISOString()
          };
          
          const response = await fetch('http://localhost:5000/api/generated', {
              method: 'POST',
              headers: {
                  'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                  design_data: {
                    canvas_data: canvasData,
                    design_analysis: designAnalysis
                  },
                  user_prompt: prompt
          })
        
        })
          
          const result = await response.json();

          // saveMessage('user', 'Generate website code (auto)');
          
          if (result.success && result.code) {
              sessionStorage.setItem('generatedCode', JSON.stringify(result.code));

              // Save AI message (short summary / explanation)
              

              // Save generated code into chat document
              if (result && result.code) {
                // saveCodeToChat(result.code);
                window.lastGeneratedCode = result.code;
              }

              
              output.innerHTML = `
                  <div class="success-message">
                      <strong>✅ Design Successfully Converted to Code!</strong>
                      <p>${result.code.explanation}</p>
                      <p><strong>Layout Type:</strong> ${result.code.layout_type || 'Standard Layout'}</p>
                      <div style="margin-top: 15px; display: flex; gap: 10px; flex-wrap: wrap;">
                          <button onclick="viewGeneratedCode()" class="tool" style="background: var(--accent); color: white;">
                              🚀 View & Export Code
                          </button>
                          <button onclick="previewLiveWebsite()" class="tool" style="background: #10b981; color: white;">
                              👁️ Live Preview
                          </button>
                          <button onclick="analyzeDesign()" class="tool" style="background: #f59e0b; color: white;">
                              🔍 Analyze Design
                          </button>
                      </div>
                  </div>
              `;
              window.lastGeneratedCode = result.code;
          } else {
              output.innerHTML = `<div class="error">❌ Error: ${result.error}</div>`;
          }
      } catch (error) {
          output.innerHTML = `<div class="error">❌ Connection failed: ${error.message}</div>`;
      }
  });

  document.getElementById('fileUpload').addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        fabric.Image.fromURL(event.target.result, (img) => {
          img.scale(0.5);
          canvas.add(img).setActiveObject(img);
          makeObjectResizable(img);
          canvas.requestRenderAll();
        });
      };
      reader.readAsDataURL(file);
    }
  });


    // === AI ENHANCE BUTTON (attach once at init) ===
  (function attachAIEnhance() {
    const aiEnhanceBtn = document.getElementById("aiEnhanceBtn");
    if (!aiEnhanceBtn) return;

    // Make AI Enhance look like other toolbar buttons (optional)
    aiEnhanceBtn.classList.add('tool');

    aiEnhanceBtn.addEventListener("click", async () => {
      const output = document.getElementById('aiOutput');
      output.innerHTML = '<div class="loading">⚡ Enhancing your design with AI...</div>';

      if (canvas.getObjects().length === 0) {
        output.innerHTML = `<div class="error">❌ Draw something on the canvas first!</div>`;
        return;
      }

      // Extract design + images
      const designAnalysis = extractDesignData();
      const canvasData = canvas.toJSON();
      const images = extractImagesFromCanvas(); // returns [{id, src}, ...]

      try {
        const response = await fetch('/api/generated', {   // use relative path (server route)
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            design_data: {
              canvas_data: canvasData,
              design_analysis: designAnalysis,
              images: images
            },
            // you can tune this prompt as needed
            user_prompt: `
              Enhance the UI design drawn on the whiteboard with professional-level improvements.
              Do NOT change the structure or layout intention—only refine and beautify it.

              Return the enhanced design in the same JSON format and include updated canvas JSON.
            `
          })
        });

        const result = await response.json();

        if (result.success && result.code) {
          output.innerHTML = `
            <div class="success-message">
              <strong>✨ Design Enhanced Successfully!</strong>
              <p>${result.code.explanation || 'AI returned enhancements.'}</p>
              <div style="margin-top:12px; display:flex; gap:8px; flex-wrap:wrap;">
                <button onclick="viewGeneratedCode()" class="tool" style="background: var(--accent); color:white;">View Updated Code</button>
                <button onclick="previewLiveWebsite()" class="tool" style="background: #10b981; color:white;">Live Preview</button>
              </div>
            </div>
          `;
          window.lastGeneratedCode = result.code;
          // Optionally: if the AI returns a modified canvas JSON, load it:
          if (result.code.updated_canvas_json) {
            try {
              canvas.loadFromJSON(result.code.updated_canvas_json, () => {
                canvas.renderAll();
                saveState(); // push updated state into undo stack
              });
            } catch (e) {
              console.warn('Failed to load updated canvas from AI:', e);
            }
          }
        } else {
          output.innerHTML = `<div class="error">❌ ${result.error || 'AI returned no code'}</div>`;
        }
      } catch (err) {
        output.innerHTML = `<div class="error">❌ AI Enhance Failed: ${err.message}</div>`;
      }
    });
  })();










  document.getElementById('generate').addEventListener('click', async () => {
    const output = document.getElementById('aiOutput');
    
    if (canvas.getObjects().length === 0) {
        output.innerHTML = `<div class="error">❌ Please draw something on the canvas first!</div>`;
        return;
    }
    
    output.innerHTML = '<div class="loading">🤖 Converting your design to code...</div>';
    
    try {
        const designAnalysis = extractDesignData();
        const canvasData = canvas.toJSON();
        const images = extractImagesFromCanvas();

        console.log(`📊 Sending ${images.length} images to AI`);
        
        const response = await fetch('http://localhost:5000/api/generated', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                design_data: {
                    canvas_data: canvasData,
                    design_analysis: designAnalysis,
                    images: images
                },
                user_prompt: "Convert this design into a modern, responsive website with proper HTML structure, CSS styling, and JavaScript interactivity."
            })
        });
        
        const result = await response.json();
        
        if (result.success && result.code) {
            sessionStorage.setItem('generatedCode', JSON.stringify(result.code));
            output.innerHTML = `
                <div class="success-message">
                    <strong>✅ Website Code Generated!</strong>
                    <p>${result.code.explanation}</p>
                    <button onclick="viewGeneratedCode()" style="background: var(--accent); color: white; border: none; padding: 10px 15px; border-radius: 4px; margin-top: 10px;">
                        🚀 View Generated Code
                    </button>
                    <button onclick="previewLiveWebsite()" class="tool" style="background: #10b981; color: white;">👁️ Live Preview</button>
                </div>
            `;
            window.lastGeneratedCode = result.code;
        } else {
            output.innerHTML = `<div class="error">❌ ${result.error}</div>`;
        }
    } catch (error) {
        output.innerHTML = `<div class="error">❌ ${error.message}</div>`;
    }
  });

  const shapesDropdown = document.getElementById('shapesDropdown');
  const shapesDropdownContent = document.getElementById('shapesDropdownContent');
  
  shapesDropdown.addEventListener('click', (e) => {
    e.stopPropagation();
    shapesDropdownContent.style.display = 
      shapesDropdownContent.style.display === 'block' ? 'none' : 'block';
  });
  
  document.addEventListener('click', () => {
    shapesDropdownContent.style.display = 'none';
  });
  
  shapesDropdownContent.addEventListener('click', (e) => {
    e.stopPropagation();
    const tool = e.target.dataset.tool;
    if (tool) {
      activateTool(tool);
      shapesDropdownContent.style.display = 'none';
    }
  });

  // ... all your existing code ...
  
  // Add this line AFTER all your existing initialization
  initCSSDesignSystem();



  // === AUTO LOAD PROJECT IF project_id EXISTS ===
  async function loadProjectIfAny() {
      if (!currentProjectId) return;

      const res = await fetch(`/api/projects/${currentProjectId}`);
      const data = await res.json();

      if (data.success && data.project.design) {
          canvas.loadFromJSON(data.project.design, () => {
              canvas.renderAll();
          });
      }
  }

loadProjectIfAny();



  // if (window.currentChatId) {
  //   loadChatData();
  // }
  
  // ... rest of your code ...


  activateTool('select');
  updateZoomDisplay();
});

// ==================== KEYBOARD SHORTCUTS ====================

document.addEventListener('keydown', function(e) {
  const activeObject = canvas.getActiveObject();
  const isEditingText = activeObject && activeObject.isEditing;
  
  const activeElement = document.activeElement;
  const isTextInput = activeElement && (
    activeElement.tagName === 'TEXTAREA' || 
    (activeElement.tagName === 'INPUT' && 
     ['text', 'email', 'password', 'search', 'url'].includes(activeElement.type))
  );
  
  if (isTextInput || isEditingText) {
    if (e.key === 'Escape') {
      if (document.activeElement) {
        document.activeElement.blur();
      }
      if (isEditingText) {
        activeObject.exitEditing();
      }
    }
    return;
  }
  
  if (currentTool === 'polygon' && e.key === 'Enter' && polygonPoints.length >= 3) {
    if (currentObject) {
      canvas.remove(currentObject);
    }
    
    const polygon = new fabric.Polygon(polygonPoints, {
      fill: fillColor === '#000000' ? 'transparent' : fillColor,
      stroke: currentColor, 
      strokeWidth: thickness,
      selectable: true,
      objectCaching: true
    });
    canvas.add(polygon);
    makeObjectResizable(polygon);
    
    isDrawing = false;
    currentObject = null;
    polygonPoints = [];
    canvas.requestRenderAll();
    return;
  }
  
  if (e.key === 'Escape') {
    if (currentTool === 'polygon') {
      if (currentObject) {
        canvas.remove(currentObject);
      }
      isDrawing = false;
      currentObject = null;
      polygonPoints = [];
      canvas.requestRenderAll();
      activateTool('select');
      return;
    }
    
    if (isZoomToAreaMode) {
      exitZoomToAreaMode();
      activateTool('select');
      return;
    }
    
    if (isEditingText) {
      activeObject.exitEditing();
      canvas.requestRenderAll();
    }
  }
  
  if (currentTool === 'select' && !isEditingText && (e.key === 'Delete' || e.key === 'Backspace') && canvas.getActiveObjects().length > 0) {
    e.preventDefault();
    const activeObjects = canvas.getActiveObjects();
    if (activeObjects.length > 0) {
      canvas.discardActiveObject();
      canvas.remove(...activeObjects);
      canvas.requestRenderAll();
    }
    return;
  }
  
  if (e.key === '-') {
    e.preventDefault();
    zoomCanvas(0.8);
  } else if (e.key === '+' || e.key === '=') {
    e.preventDefault();
    zoomCanvas(1.2);
  } else if (e.key === '0') {
    e.preventDefault();
    resetZoom();
  }
  
  if ((e.key === 'h' || e.key === 'H') && !isEditingText) {
    e.preventDefault();
    document.getElementById('toggleToolbar').click();
  }
  
  if (!isEditingText) {
    switch(e.key.toLowerCase()) {
      case 'v': e.preventDefault(); activateTool('select'); break;
      case 'r': e.preventDefault(); activateTool('rectangle'); break;
      case 'c': e.preventDefault(); activateTool('circle'); break;
      case 't': if (currentTool !== 'text') { e.preventDefault(); activateTool('text'); } break;
      case 'l': e.preventDefault(); activateTool('line'); break;
      case 'a': e.preventDefault(); activateTool('arrow'); break;
      case 'p': e.preventDefault(); activateTool('polygon'); break;
      case 'z': e.preventDefault(); activateTool('zoomToArea'); break;
    }
  }
  
  if (currentTool === 'select' && activeObject && !isEditingText) {
    if (e.key === 'ArrowUp' && e.shiftKey) {
      e.preventDefault();
      canvas.bringToFront(activeObject);
    } else if (e.key === 'ArrowDown' && e.shiftKey) {
      e.preventDefault();
      canvas.sendToBack(activeObject);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      canvas.bringForward(activeObject);
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      canvas.sendBackwards(activeObject);
    }
    canvas.requestRenderAll();
  }
});

// ==================== UTILITY FUNCTIONS ====================

window.viewDesignJSON = () => {
  const design = JSON.parse(localStorage.getItem('designJSON') || '{}');
  const win = window.open();
  win.document.write(`
    <html><body>
      <h2>Design JSON Data</h2>
      <pre>${JSON.stringify(design, null, 2)}</pre>
    </body></html>
  `);
};

window.viewGeneratedCode = function() {
  if (!window.lastGeneratedCode) {
    alert('No code generated yet');
    return;
  }
  sessionStorage.setItem('generatedCode', JSON.stringify(window.lastGeneratedCode));
  window.open('/code-display', '_blank');
};

window.previewLiveWebsite = function() {
  if (!window.lastGeneratedCode) {
    alert('No code generated yet');
    return;
  }
  
  const previewWindow = window.open('', '_blank');
  const htmlContent =
      window.lastGeneratedCode.html ||
      window.lastGeneratedCode.main_html ||
      '<h1>No HTML generated</h1>';

  const cssContent =
      window.lastGeneratedCode.css ||
      window.lastGeneratedCode.main_css ||
      '/* No CSS */';

  const jsContent =
      window.lastGeneratedCode.javascript ||
      window.lastGeneratedCode.main_js ||
      '// No JS';

  
  previewWindow.document.write(`
    <!DOCTYPE html>
    <html>
    <head>
        <title>Live Preview - Whiteboard2Web</title>
        <style>${cssContent}</style>
    </head>
    <body>
        ${htmlContent}
        <script>${jsContent}<\/script>
    </body>
    </html>
  `);
  previewWindow.document.close();
};

window.analyzeDesign = function() {
    const designAnalysis = extractDesignData();
    
    const analysisWindow = window.open();
    analysisWindow.document.write(`
        <!DOCTYPE html>
        <html>
        <head>
            <title>Design Analysis - Whiteboard2Web</title>
            <style>
                body { font-family: monospace; padding: 20px; background: #1e1e1e; color: #d4d4d4; }
                pre { background: #2d2d2d; padding: 15px; border-radius: 5px; overflow-x: auto; }
                .section { margin-bottom: 20px; }
                .stats { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 10px; margin-bottom: 20px; }
                .stat-card { background: #252526; padding: 15px; border-radius: 5px; }
            </style>
        </head>
        <body>
            <h2>🎨 Design Analysis</h2>
            
            <div class="stats">
                <div class="stat-card">
                    <h3>📊 Elements</h3>
                    <p>Text: ${designAnalysis.elements.text.length}</p>
                    <p>Shapes: ${designAnalysis.elements.shapes.length}</p>
                    <p>Buttons: ${designAnalysis.elements.buttons.length}</p>
                    <p>Containers: ${designAnalysis.elements.containers.length}</p>
                </div>
                <div class="stat-card">
                    <h3>🎨 Colors</h3>
                    ${designAnalysis.styles.colors.map(color => 
                        `<div style="display: flex; align-items: center; gap: 8px; margin: 5px 0;">
                            <div style="width: 20px; height: 20px; background: ${color}; border: 1px solid #555;"></div>
                            <span>${color}</span>
                        </div>`
                    ).join('')}
                </div>
                <div class="stat-card">
                    <h3>🔤 Fonts</h3>
                    ${designAnalysis.styles.fonts.map(font => 
                        `<p>${font}</p>`
                    ).join('')}
                </div>
            </div>
            
            <div class="section">
                <h3>📐 Layout Structure</h3>
                <pre>${JSON.stringify(designAnalysis.layout, null, 2)}</pre>
            </div>
            
            <div class="section">
                <h3>📋 All Elements</h3>
                <pre>${JSON.stringify(designAnalysis.elements, null, 2)}</pre>
            </div>
            
            <button onclick="window.close()" style="padding: 10px 20px; background: #007acc; color: white; border: none; border-radius: 4px; cursor: pointer;">
                Close
            </button>
        </body>
        </html>
    `);
};

window.downloadHTML = function() {
  if (!window.lastGeneratedCode) return;
  downloadFile('index.html', window.lastGeneratedCode.html || '<!-- No HTML -->');
};

window.downloadCSS = function() {
  if (!window.lastGeneratedCode) return;
  downloadFile('styles.css', window.lastGeneratedCode.css || '/* No CSS */');
};

window.downloadJS = function() {
  if (!window.lastGeneratedCode) return;
  downloadFile('script.js', window.lastGeneratedCode.javascript || '// No JS');
};

window.downloadAllFiles = function() {
  if (!window.lastGeneratedCode) return;
  downloadHTML();
  setTimeout(downloadCSS, 100);
  setTimeout(downloadJS, 200);
};

function downloadFile(filename, content) {
  const blob = new Blob([content], { type: 'text/plain' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}


// ==================== ENHANCED SCRIPT.JS WITH CSS INTEGRATION ====================

// Add these functions to your existing script.js

// 1. CSS Properties Inspector

function createCSSInspector() {
  if (cssInspector) return cssInspector;
  
  cssInspector = document.createElement('div');
  cssInspector.id = 'cssInspector';
  cssInspector.className = 'css-inspector collapsed';
  cssInspector.innerHTML = `
    <div class="inspector-header">
      <h3>🎨 CSS Properties</h3>
      <button id="closeInspector" class="inspector-toggle">×</button>
    </div>
    
    <div class="inspector-tabs">
      <button class="tab-btn active" data-tab="fill">Fill</button>
      <button class="tab-btn" data-tab="border">Border</button>
      <button class="tab-btn" data-tab="shadow">Shadow</button>
      <button class="tab-btn" data-tab="text">Text</button>
      <button class="tab-btn" data-tab="css">CSS Code</button>
    </div>
    
    <div class="inspector-content">
      <!-- Fill Tab -->
      <div class="tab-content active" id="fillTab">
        <div class="property-group">
          <label>Fill Color</label>
          <div class="color-input-group">
            <input type="color" id="inspectorFillColor" value="#ffffff">
            <span id="fillColorValue">#ffffff</span>
          </div>
        </div>
        <div class="property-group">
          <label>Opacity</label>
          <input type="range" id="fillOpacity" min="0" max="100" value="100">
          <span id="opacityValue">100%</span>
        </div>
        <div class="property-group">
          <label>Gradient</label>
          <div class="button-group">
            <button id="addLinearGradient" class="property-btn small">Linear</button>
            <button id="addRadialGradient" class="property-btn small">Radial</button>
            <button id="removeGradient" class="property-btn small danger">Remove</button>
          </div>
        </div>
      </div>
      
      <!-- Border Tab -->
      <div class="tab-content" id="borderTab">
        <div class="property-group">
          <label>Border Color</label>
          <div class="color-input-group">
            <input type="color" id="inspectorBorderColor" value="#e5e7eb">
            <span id="borderColorValue">#e5e7eb</span>
          </div>
        </div>
        <div class="property-group">
          <label>Border Width</label>
          <input type="range" id="inspectorBorderWidth" min="0" max="20" value="1">
          <span id="borderWidthValue">1px</span>
        </div>
        <div class="property-group">
          <label>Border Style</label>
          <select id="borderStyle">
            <option value="solid">Solid</option>
            <option value="dashed">Dashed</option>
            <option value="dotted">Dotted</option>
          </select>
        </div>
        <div class="property-group">
          <label>Border Radius</label>
          <input type="range" id="inspectorBorderRadius" min="0" max="80" value="6">
          <span id="borderRadiusValue">6px</span>
        </div>
      </div>
      
      <!-- Shadow Tab -->
      <div class="tab-content" id="shadowTab">
        <div class="property-group">
          <label>Shadow Color</label>
          <input type="color" id="inspectorShadowColor" value="#000000">
        </div>
        <div class="property-group">
          <label>X Offset</label>
          <input type="range" id="shadowXOffset" min="-50" max="50" value="0">
          <span id="shadowXValue">0px</span>
        </div>
        <div class="property-group">
          <label>Y Offset</label>
          <input type="range" id="shadowYOffset" min="-50" max="50" value="0">
          <span id="shadowYValue">0px</span>
        </div>
        <div class="property-group">
          <label>Blur</label>
          <input type="range" id="shadowBlurAmount" min="0" max="50" value="0">
          <span id="shadowBlurValue">0px</span>
        </div>
        <div class="property-group">
          <label>Spread</label>
          <input type="range" id="shadowSpread" min="0" max="50" value="0">
          <span id="shadowSpreadValue">0px</span>
        </div>
        <button id="applyShadowBtn" class="apply-btn">Apply Shadow</button>
        <button id="removeShadowBtn" class="cancel-btn">Remove Shadow</button>
      </div>
      
      <!-- Text Tab -->
      <div class="tab-content" id="textTab">
        <div class="property-group">
          <label>Font Family</label>
          <select id="inspectorFontFamily">
            <option value="Arial">Arial</option>
            <option value="Helvetica">Helvetica</option>
            <option value="Georgia">Georgia</option>
            <option value="Times New Roman">Times New Roman</option>
            <option value="Courier New">Courier New</option>
            <option value="Verdana">Verdana</option>
            <option value="Tahoma">Tahoma</option>
          </select>
        </div>
        <div class="property-group">
          <label>Font Size</label>
          <input type="range" id="inspectorFontSize" min="8" max="72" value="16">
          <span id="fontSizeValue">16px</span>
        </div>
        <div class="property-group">
          <label>Font Weight</label>
          <select id="inspectorFontWeight">
            <option value="normal">Normal</option>
            <option value="bold">Bold</option>
            <option value="300">Light</option>
            <option value="500">Medium</option>
            <option value="700">Bold</option>
            <option value="900">Black</option>
          </select>
        </div>
        <div class="property-group">
          <label>Text Color</label>
          <input type="color" id="inspectorTextColor" value="#000000">
        </div>
        <div class="property-group">
          <label>Text Align</label>
          <select id="inspectorTextAlign">
            <option value="left">Left</option>
            <option value="center">Center</option>
            <option value="right">Right</option>
            <option value="justify">Justify</option>
          </select>
        </div>
      </div>
      
      <!-- CSS Code Tab -->
      <div class="tab-content" id="cssTab">
        <div class="css-output">
          <h4>Generated CSS</h4>
          <pre id="cssCodeOutput">/* Select an object to see CSS */</pre>
          <div class="button-group">
            <button id="copyCssBtn" class="copy-btn">📋 Copy CSS</button>
            <button id="applyToAllBtn" class="property-btn">Apply to Similar</button>
          </div>
          <div class="css-preview">
            <h4>Preview</h4>
            <div id="cssPreviewBox" class="preview-box"></div>
          </div>
        </div>
      </div>
    </div>
  `;
  
  document.body.appendChild(cssInspector);
  wireCSSInspectorEvents();
  return cssInspector;
}

function wireCSSInspectorEvents() {
  // Toggle inspector
  document.getElementById('closeInspector').addEventListener('click', function() {
    cssInspector.classList.toggle('collapsed');
  });
  
  // Tab switching
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', function() {
      document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
      document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
      this.classList.add('active');
      document.getElementById(this.dataset.tab + 'Tab').classList.add('active');
    });
  });
  
  // Fill color
  document.getElementById('inspectorFillColor').addEventListener('input', function(e) {
    if (currentSelectedObject) {
      const color = e.target.value;
      currentSelectedObject.set('fill', color);
      document.getElementById('fillColorValue').textContent = color;
      canvas.requestRenderAll();
      updateCSSCode();
      // Sync with toolbar color picker
      document.getElementById('fillColorPicker').value = color;
    }
  });
  
  // Opacity
  document.getElementById('fillOpacity').addEventListener('input', function(e) {
    if (currentSelectedObject) {
      const opacity = parseInt(e.target.value) / 100;
      currentSelectedObject.set('opacity', opacity);
      document.getElementById('opacityValue').textContent = e.target.value + '%';
      canvas.requestRenderAll();
      updateCSSCode();
    }
  });
  
  // Border color
  document.getElementById('inspectorBorderColor').addEventListener('input', function(e) {
    if (currentSelectedObject) {
      const color = e.target.value;
      currentSelectedObject.set('stroke', color);
      document.getElementById('borderColorValue').textContent = color;
      canvas.requestRenderAll();
      updateCSSCode();
      // Sync with toolbar color picker
      document.getElementById('strokeColorPicker').value = color;
    }
  });
  
  // Border width
  document.getElementById('inspectorBorderWidth').addEventListener('input', function(e) {
    if (currentSelectedObject) {
      const width = parseInt(e.target.value);
      currentSelectedObject.set('strokeWidth', width);
      document.getElementById('borderWidthValue').textContent = width + 'px';
      canvas.requestRenderAll();
      updateCSSCode();
      // Sync with toolbar thickness
      document.getElementById('thickness').value = width;
    }
  });
  
  // Border radius
  document.getElementById('inspectorBorderRadius').addEventListener('input', function(e) {
    if (currentSelectedObject && (currentSelectedObject.type === 'rect' || currentSelectedObject.type === 'triangle')) {
      const radius = parseInt(e.target.value);
      currentSelectedObject.set({
        rx: radius,
        ry: radius
      });
      document.getElementById('borderRadiusValue').textContent = radius + 'px';
      canvas.requestRenderAll();
      updateCSSCode();
    }
  });
  
  // Border style
  document.getElementById('borderStyle').addEventListener('change', function(e) {
    if (currentSelectedObject) {
      const style = e.target.value;
      let dashArray = null;
      if (style === 'dashed') dashArray = [5, 5];
      if (style === 'dotted') dashArray = [2, 2];
      currentSelectedObject.set('strokeDashArray', dashArray);
      canvas.requestRenderAll();
      updateCSSCode();
    }
  });
  
  // Shadow controls
  document.getElementById('applyShadowBtn').addEventListener('click', function() {
    if (currentSelectedObject) {
      const color = document.getElementById('inspectorShadowColor').value;
      const x = parseInt(document.getElementById('shadowXOffset').value);
      const y = parseInt(document.getElementById('shadowYOffset').value);
      const blur = parseInt(document.getElementById('shadowBlurAmount').value);
      const spread = parseInt(document.getElementById('shadowSpread').value);
      
      currentSelectedObject.set('shadow', new fabric.Shadow({
        color: color,
        blur: blur,
        offsetX: x,
        offsetY: y,
        affectStroke: true,
        nonScaling: false
      }));
      
      canvas.requestRenderAll();
      updateCSSCode();
    }
  });
  
  document.getElementById('removeShadowBtn').addEventListener('click', function() {
    if (currentSelectedObject) {
      currentSelectedObject.set('shadow', null);
      canvas.requestRenderAll();
      updateCSSCode();
    }
  });
  
  // Update shadow value displays
  ['shadowXOffset', 'shadowYOffset', 'shadowBlurAmount', 'shadowSpread'].forEach(id => {
    document.getElementById(id).addEventListener('input', function(e) {
      document.getElementById(id.replace('Offset', 'Value').replace('Amount', 'Value').replace('Spread', 'SpreadValue')).textContent = e.target.value + 'px';
    });
  });
  
  // Text controls
  document.getElementById('inspectorFontSize').addEventListener('input', function(e) {
    if (currentSelectedObject && (currentSelectedObject.type === 'text' || currentSelectedObject.type === 'i-text')) {
      const size = parseInt(e.target.value);
      currentSelectedObject.set('fontSize', size);
      document.getElementById('fontSizeValue').textContent = size + 'px';
      canvas.requestRenderAll();
      updateCSSCode();
      // Sync with toolbar font size
      document.getElementById('fontSize').value = size;
    }
  });
  
  document.getElementById('inspectorFontFamily').addEventListener('change', function(e) {
    if (currentSelectedObject && (currentSelectedObject.type === 'text' || currentSelectedObject.type === 'i-text')) {
      currentSelectedObject.set('fontFamily', e.target.value);
      canvas.requestRenderAll();
      updateCSSCode();
    }
  });
  
  document.getElementById('inspectorTextColor').addEventListener('input', function(e) {
    if (currentSelectedObject && (currentSelectedObject.type === 'text' || currentSelectedObject.type === 'i-text')) {
      currentSelectedObject.set('fill', e.target.value);
      canvas.requestRenderAll();
      updateCSSCode();
    }
  });
  
  // Gradient buttons
  document.getElementById('addLinearGradient').addEventListener('click', function() {
    if (currentSelectedObject) {
      openGradientEditor('linear');
    }
  });
  
  document.getElementById('addRadialGradient').addEventListener('click', function() {
    if (currentSelectedObject) {
      openGradientEditor('radial');
    }
  });
  
  document.getElementById('removeGradient').addEventListener('click', function() {
    if (currentSelectedObject && currentSelectedObject.fill instanceof fabric.Gradient) {
      currentSelectedObject.set('fill', '#ffffff');
      canvas.requestRenderAll();
      updateCSSCode();
    }
  });
  
  // Copy CSS button
  document.getElementById('copyCssBtn').addEventListener('click', function() {
    const cssCode = document.getElementById('cssCodeOutput').textContent;
    navigator.clipboard.writeText(cssCode).then(() => {
      const btn = this;
      const originalText = btn.textContent;
      btn.textContent = '✅ Copied!';
      setTimeout(() => {
        btn.textContent = originalText;
      }, 2000);
    });
  });
}

// 2. GRADIENT EDITOR
function openGradientEditor(type = 'linear') {
  if (!currentSelectedObject) return;
  
  const editor = document.createElement('div');
  editor.className = 'gradient-editor-overlay';
  editor.innerHTML = `
    <div class="gradient-editor">
      <div class="editor-header">
        <h3>🎨 Gradient Editor</h3>
        <button class="close-gradient-editor">×</button>
      </div>
      <div class="gradient-preview" id="gradientLivePreview"></div>
      <div class="gradient-controls">
        <div class="control-row">
          <label>Type:</label>
          <select id="gradientTypeSelect">
            <option value="linear" ${type === 'linear' ? 'selected' : ''}>Linear</option>
            <option value="radial" ${type === 'radial' ? 'selected' : ''}>Radial</option>
          </select>
        </div>
        <div class="control-row">
          <label>Angle:</label>
          <input type="range" id="gradientAngle" min="0" max="360" value="90">
          <span id="gradientAngleValue">90°</span>
        </div>
        <div class="color-stops-container">
          <h4>Color Stops</h4>
          <div class="color-stops" id="colorStopsList">
            <div class="color-stop-item">
              <input type="color" class="stop-color" value="#0078ff">
              <input type="range" class="stop-position" min="0" max="100" value="0">
              <span class="stop-percent">0%</span>
              <button class="remove-stop" disabled>×</button>
            </div>
            <div class="color-stop-item">
              <input type="color" class="stop-color" value="#00c6ff">
              <input type="range" class="stop-position" min="0" max="100" value="100">
              <span class="stop-percent">100%</span>
              <button class="remove-stop">×</button>
            </div>
          </div>
          <button id="addColorStopBtn" class="add-stop-btn">+ Add Color Stop</button>
        </div>
        <div class="editor-actions">
          <button id="applyGradientBtn" class="apply-btn">Apply Gradient</button>
          <button id="cancelGradientBtn" class="cancel-btn">Cancel</button>
        </div>
      </div>
    </div>
  `;
  
  document.body.appendChild(editor);
  
  // Update preview
  function updateGradientPreview() {
    const type = document.getElementById('gradientTypeSelect').value;
    const angle = parseInt(document.getElementById('gradientAngle').value);
    const colorStops = [];
    
    document.querySelectorAll('.color-stop-item').forEach(item => {
      const color = item.querySelector('.stop-color').value;
      const position = parseInt(item.querySelector('.stop-position').value) / 100;
      colorStops.push({color, position});
    });
    
    const preview = document.getElementById('gradientLivePreview');
    if (type === 'linear') {
      const gradientStr = `linear-gradient(${angle}deg, ${colorStops.map(s => `${s.color} ${s.position * 100}%`).join(', ')})`;
      preview.style.background = gradientStr;
    } else {
      const gradientStr = `radial-gradient(circle, ${colorStops.map(s => `${s.color} ${s.position * 100}%`).join(', ')})`;
      preview.style.background = gradientStr;
    }
  }
  
  // Initialize
  updateGradientPreview();
  
  // Event listeners
  document.getElementById('gradientTypeSelect').addEventListener('change', updateGradientPreview);
  document.getElementById('gradientAngle').addEventListener('input', function(e) {
    document.getElementById('gradientAngleValue').textContent = e.target.value + '°';
    updateGradientPreview();
  });
  
  // Color stop events
  document.querySelectorAll('.stop-color, .stop-position').forEach(input => {
    input.addEventListener('input', function() {
      const item = this.closest('.color-stop-item');
      const position = item.querySelector('.stop-position').value;
      item.querySelector('.stop-percent').textContent = position + '%';
      updateGradientPreview();
    });
  });
  
  // Remove stop
  document.querySelectorAll('.remove-stop').forEach(btn => {
    btn.addEventListener('click', function() {
      if (document.querySelectorAll('.color-stop-item').length > 2) {
        this.closest('.color-stop-item').remove();
        updateGradientPreview();
      }
    });
  });
  
  // Add stop
  document.getElementById('addColorStopBtn').addEventListener('click', function() {
    const colorStopsList = document.getElementById('colorStopsList');
    const newStop = document.createElement('div');
    newStop.className = 'color-stop-item';
    newStop.innerHTML = `
      <input type="color" class="stop-color" value="#ffffff">
      <input type="range" class="stop-position" min="0" max="100" value="50">
      <span class="stop-percent">50%</span>
      <button class="remove-stop">×</button>
    `;
    
    // Add events to new stop
    newStop.querySelectorAll('.stop-color, .stop-position').forEach(input => {
      input.addEventListener('input', function() {
        const position = newStop.querySelector('.stop-position').value;
        newStop.querySelector('.stop-percent').textContent = position + '%';
        updateGradientPreview();
      });
    });
    
    newStop.querySelector('.remove-stop').addEventListener('click', function() {
      if (document.querySelectorAll('.color-stop-item').length > 2) {
        newStop.remove();
        updateGradientPreview();
      }
    });
    
    colorStopsList.appendChild(newStop);
    updateGradientPreview();
  });
  
  // Apply gradient
  document.getElementById('applyGradientBtn').addEventListener('click', function() {
    const type = document.getElementById('gradientTypeSelect').value;
    const angle = parseInt(document.getElementById('gradientAngle').value);
    
    const colors = [];
    const stops = [];
    document.querySelectorAll('.color-stop-item').forEach(item => {
      colors.push(item.querySelector('.stop-color').value);
      stops.push(parseInt(item.querySelector('.stop-position').value) / 100);
    });
    
    applyGradientToObject(currentSelectedObject, type, angle, colors, stops);
    document.body.removeChild(editor);
    updateCSSCode();
  });
  
  // Cancel
  document.querySelector('.close-gradient-editor').addEventListener('click', function() {
    document.body.removeChild(editor);
  });
  
  document.getElementById('cancelGradientBtn').addEventListener('click', function() {
    document.body.removeChild(editor);
  });
}

function applyGradientToObject(obj, type, angle, colors, stops) {
  const width = obj.width * (obj.scaleX || 1);
  const height = obj.height * (obj.scaleY || 1);
  
  let coords;
  if (type === 'linear') {
    const rad = (angle - 90) * (Math.PI / 180);
    const x2 = Math.cos(rad) * width;
    const y2 = Math.sin(rad) * height;
    coords = { x1: 0, y1: 0, x2: x2, y2: y2 };
  } else {
    coords = { 
      x1: width/2, 
      y1: height/2, 
      r1: 0, 
      x2: width/2, 
      y2: height/2, 
      r2: Math.min(width, height)/2 
    };
  }
  
  const colorStops = colors.map((color, index) => ({
    offset: stops[index],
    color: color
  }));
  
  obj.set('fill', new fabric.Gradient({
    type: type,
    gradientUnits: 'pixels',
    coords: coords,
    colorStops: colorStops
  }));
  
  canvas.requestRenderAll();
}

// 3. CSS CODE GENERATOR
function generateCSSCode(obj) {
  let css = `/* CSS for ${obj.type} */\n`;
  css += `.${obj.type}-element {\n`;
  
  // Common properties
  css += `  /* Position & Size */\n`;
  css += `  position: absolute;\n`;
  css += `  left: ${obj.left}px;\n`;
  css += `  top: ${obj.top}px;\n`;
  css += `  width: ${obj.width * (obj.scaleX || 1)}px;\n`;
  css += `  height: ${obj.height * (obj.scaleY || 1)}px;\n`;
  
  if (obj.angle) {
    css += `  transform: rotate(${obj.angle}deg);\n`;
  }
  
  // Fill/Background
  css += `\n  /* Background */\n`;
  if (obj.fill) {
    if (obj.fill instanceof fabric.Gradient) {
      const grad = obj.fill;
      if (grad.type === 'linear') {
        const angle = Math.atan2(grad.coords.y2, grad.coords.x2) * (180 / Math.PI);
        css += `  background: linear-gradient(${angle}deg, ${grad.colorStops.map(s => `${s.color} ${s.offset * 100}%`).join(', ')});\n`;
      } else {
        css += `  background: radial-gradient(circle at ${grad.coords.x1}px ${grad.coords.y1}px, ${grad.colorStops.map(s => `${s.color} ${s.offset * 100}%`).join(', ')});\n`;
      }
    } else {
      css += `  background: ${obj.fill};\n`;
    }
  }
  
  if (obj.opacity && obj.opacity !== 1) {
    css += `  opacity: ${obj.opacity};\n`;
  }
  
  // Border
  css += `\n  /* Border */\n`;
  if (obj.stroke && obj.strokeWidth > 0) {
    css += `  border: ${obj.strokeWidth}px solid ${obj.stroke};\n`;
    if (obj.strokeDashArray) {
      css += `  border-style: dashed;\n`;
    }
  }
  
  if (obj.rx || obj.ry) {
    const radius = obj.rx || obj.ry;
    css += `  border-radius: ${radius}px;\n`;
  }
  
  // Shadow
  css += `\n  /* Shadow */\n`;
  if (obj.shadow) {
    const s = obj.shadow;
    css += `  box-shadow: ${s.offsetX}px ${s.offsetY}px ${s.blur}px ${s.color};\n`;
  }
  
  // Text specific
  if (obj.type === 'text' || obj.type === 'i-text') {
    css += `\n  /* Text */\n`;
    css += `  font-family: ${obj.fontFamily || 'Arial, sans-serif'};\n`;
    css += `  font-size: ${obj.fontSize}px;\n`;
    css += `  color: ${obj.fill};\n`;
    if (obj.fontWeight) css += `  font-weight: ${obj.fontWeight};\n`;
    if (obj.textAlign) css += `  text-align: ${obj.textAlign};\n`;
    if (obj.lineHeight) css += `  line-height: ${obj.lineHeight};\n`;
  }
  
  css += `}`;
  
  // Add vendor prefixes for gradients
  if (obj.fill instanceof fabric.Gradient && obj.fill.type === 'linear') {
    const grad = obj.fill;
    const angle = Math.atan2(grad.coords.y2, grad.coords.x2) * (180 / Math.PI);
    css += `\n\n/* Vendor prefixes for older browsers */\n`;
    css += `.${obj.type}-element {\n`;
    css += `  background: -webkit-linear-gradient(${angle}deg, ${grad.colorStops.map(s => `${s.color} ${s.offset * 100}%`).join(', ')});\n`;
    css += `  background: -moz-linear-gradient(${angle}deg, ${grad.colorStops.map(s => `${s.color} ${s.offset * 100}%`).join(', ')});\n`;
    css += `  background: -o-linear-gradient(${angle}deg, ${grad.colorStops.map(s => `${s.color} ${s.offset * 100}%`).join(', ')});\n`;
    css += `}`;
  }
  
  return css;
}

function updateCSSCode() {
  if (!currentSelectedObject) {
    document.getElementById('cssCodeOutput').textContent = '/* Select an object to see CSS */';
    return;
  }
  
  const css = generateCSSCode(currentSelectedObject);
  document.getElementById('cssCodeOutput').textContent = css;
  
  // Update preview box
  const previewBox = document.getElementById('cssPreviewBox');
  if (previewBox) {
    previewBox.style.cssText = css.split('\n').slice(1, -1).join('\n');
  }
}

// 4. HOOK INTO EXISTING TOOLBAR CONTROLS
function syncToolbarWithInspector() {
  // When toolbar controls change, update inspector and selected object
  const strokeColorPicker = document.getElementById('strokeColorPicker');
  const fillColorPicker = document.getElementById('fillColorPicker');
  const thicknessSlider = document.getElementById('thickness');
  const fontSizeSlider = document.getElementById('fontSize');
  
  if (strokeColorPicker) {
    strokeColorPicker.addEventListener('input', function(e) {
      if (currentSelectedObject) {
        currentSelectedObject.set('stroke', e.target.value);
        canvas.requestRenderAll();
        updateCSSCode();
        // Update inspector
        if (cssInspector) {
          document.getElementById('inspectorBorderColor').value = e.target.value;
          document.getElementById('borderColorValue').textContent = e.target.value;
        }
      }
    });
  }
  
  if (fillColorPicker) {
    fillColorPicker.addEventListener('input', function(e) {
      if (currentSelectedObject) {
        currentSelectedObject.set('fill', e.target.value);
        canvas.requestRenderAll();
        updateCSSCode();
        // Update inspector
        if (cssInspector) {
          document.getElementById('inspectorFillColor').value = e.target.value;
          document.getElementById('fillColorValue').textContent = e.target.value;
        }
      }
    });
  }
  
  if (thicknessSlider) {
    thicknessSlider.addEventListener('input', function(e) {
      if (currentSelectedObject) {
        currentSelectedObject.set('strokeWidth', parseInt(e.target.value));
        canvas.requestRenderAll();
        updateCSSCode();
        // Update inspector
        if (cssInspector) {
          document.getElementById('inspectorBorderWidth').value = e.target.value;
          document.getElementById('borderWidthValue').textContent = e.target.value + 'px';
        }
      }
    });
  }
  
  if (fontSizeSlider) {
    fontSizeSlider.addEventListener('input', function(e) {
      if (currentSelectedObject && (currentSelectedObject.type === 'text' || currentSelectedObject.type === 'i-text')) {
        currentSelectedObject.set('fontSize', parseInt(e.target.value));
        canvas.requestRenderAll();
        updateCSSCode();
        // Update inspector
        if (cssInspector) {
          document.getElementById('inspectorFontSize').value = e.target.value;
          document.getElementById('fontSizeValue').textContent = e.target.value + 'px';
        }
      }
    });
  }
}

// 5. CANVAS SELECTION HOOKS
function setupCanvasSelectionHooks() {
  // Show inspector when object is selected
  canvas.on('selection:created', function(e) {
    if (e.selected && e.selected.length === 1) {
      currentSelectedObject = e.selected[0];
      showCSSInspector();
      updateInspectorValues();
      updateCSSCode();
    }
  });
  
  canvas.on('selection:updated', function(e) {
    if (e.selected && e.selected.length === 1) {
      currentSelectedObject = e.selected[0];
      showCSSInspector();
      updateInspectorValues();
      updateCSSCode();
    }
  });
  
  canvas.on('selection:cleared', function() {
    currentSelectedObject = null;
    hideCSSInspector();
  });
}

function showCSSInspector() {
  if (!cssInspector) createCSSInspector();
  cssInspector.classList.remove('collapsed');
}

function hideCSSInspector() {
  if (cssInspector) {
    cssInspector.classList.add('collapsed');
  }
}

function updateInspectorValues() {
  if (!currentSelectedObject || !cssInspector) return;
  
  const obj = currentSelectedObject;
  
  // Fill color
  if (obj.fill && typeof obj.fill === 'string') {
    document.getElementById('inspectorFillColor').value = obj.fill;
    document.getElementById('fillColorValue').textContent = obj.fill;
  }
  
  // Opacity
  if (obj.opacity) {
    const opacityPercent = Math.round(obj.opacity * 100);
    document.getElementById('fillOpacity').value = opacityPercent;
    document.getElementById('opacityValue').textContent = opacityPercent + '%';
  }
  
  // Border
  if (obj.stroke) {
    document.getElementById('inspectorBorderColor').value = obj.stroke;
    document.getElementById('borderColorValue').textContent = obj.stroke;
  }
  if (obj.strokeWidth) {
    document.getElementById('inspectorBorderWidth').value = obj.strokeWidth;
    document.getElementById('borderWidthValue').textContent = obj.strokeWidth + 'px';
  }
  if (obj.rx) {
    document.getElementById('inspectorBorderRadius').value = obj.rx;
    document.getElementById('borderRadiusValue').textContent = obj.rx + 'px';
  }
  
  // Shadow
  if (obj.shadow) {
    document.getElementById('inspectorShadowColor').value = obj.shadow.color || '#000000';
    document.getElementById('shadowXOffset').value = obj.shadow.offsetX || 0;
    document.getElementById('shadowYOffset').value = obj.shadow.offsetY || 0;
    document.getElementById('shadowBlurAmount').value = obj.shadow.blur || 0;
    document.getElementById('shadowXValue').textContent = (obj.shadow.offsetX || 0) + 'px';
    document.getElementById('shadowYValue').textContent = (obj.shadow.offsetY || 0) + 'px';
    document.getElementById('shadowBlurValue').textContent = (obj.shadow.blur || 0) + 'px';
  }
  
  // Text properties
  if (obj.type === 'text' || obj.type === 'i-text') {
    if (obj.fontSize) {
      document.getElementById('inspectorFontSize').value = obj.fontSize;
      document.getElementById('fontSizeValue').textContent = obj.fontSize + 'px';
    }
    if (obj.fontFamily) {
      document.getElementById('inspectorFontFamily').value = obj.fontFamily;
    }
    if (obj.fontWeight) {
      document.getElementById('inspectorFontWeight').value = obj.fontWeight;
    }
    if (obj.fill && typeof obj.fill === 'string') {
      document.getElementById('inspectorTextColor').value = obj.fill;
    }
    if (obj.textAlign) {
      document.getElementById('inspectorTextAlign').value = obj.textAlign;
    }
  }
}

// 6. INITIALIZATION
function initCSSDesignSystem() {
  // Create inspector
  createCSSInspector();
  
  // Setup canvas hooks
  setupCanvasSelectionHooks();
  
  // Sync with toolbar
  syncToolbarWithInspector();
  
  // Add CSS to page
  addCSSInspectorStyles();
}

function addCSSInspectorStyles() {
  const style = document.createElement('style');
  style.textContent = `
    /* CSS Inspector */
    .css-inspector {
      position: fixed;
      top: 80px;
      right: 340px;
      width: 350px;
      height: calc(100vh - 100px);
      background: var(--panel);
      border: 1px solid var(--border);
      border-radius: 12px;
      z-index: 120;
      transition: transform 0.3s ease;
      box-shadow: -2px 0 20px rgba(0,0,0,0.3);
      display: flex;
      flex-direction: column;
      overflow: hidden;
    }
    
    .css-inspector.collapsed {
      transform: translateX(calc(100% + 20px));
    }
    
    .inspector-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 16px;
      border-bottom: 1px solid var(--border);
      flex-shrink: 0;
    }
    
    .inspector-header h3 {
      margin: 0;
      color: var(--accent);
      font-size: 16px;
    }
    
    .inspector-toggle {
      background: none;
      border: none;
      color: var(--muted);
      font-size: 20px;
      cursor: pointer;
      padding: 4px 8px;
      border-radius: 4px;
      transition: all 0.2s;
    }
    
    .inspector-toggle:hover {
      background: rgba(255,255,255,0.1);
      color: #fff;
    }
    
    .inspector-tabs {
      display: flex;
      border-bottom: 1px solid var(--border);
      padding: 0 16px;
      flex-shrink: 0;
      overflow-x: auto;
    }
    
    .tab-btn {
      flex: 1;
      background: none;
      border: none;
      color: var(--muted);
      padding: 10px 0;
      cursor: pointer;
      font-size: 12px;
      transition: all 0.2s;
      border-bottom: 2px solid transparent;
      min-width: 60px;
      white-space: nowrap;
    }
    
    .tab-btn:hover {
      color: #fff;
    }
    
    .tab-btn.active {
      color: var(--accent);
      border-bottom-color: var(--accent);
    }
    
    .inspector-content {
      flex: 1;
      overflow-y: auto;
      padding: 16px;
    }
    
    .tab-content {
      display: none;
    }
    
    .tab-content.active {
      display: block;
      animation: fadeIn 0.3s ease;
    }
    
    .property-group {
      margin-bottom: 15px;
    }
    
    .property-group label {
      display: block;
      margin-bottom: 6px;
      color: var(--muted);
      font-size: 13px;
      font-weight: 500;
    }
    
    .color-input-group {
      display: flex;
      align-items: center;
      gap: 10px;
    }
    
    .color-input-group input[type="color"] {
      width: 40px;
      height: 40px;
      border: 1px solid var(--border);
      border-radius: 6px;
      background: none;
      cursor: pointer;
    }
    
    .color-input-group span {
      font-size: 12px;
      color: var(--muted);
    }
    
    .button-group {
      display: flex;
      gap: 8px;
      flex-wrap: wrap;
    }
    
    .property-btn {
      padding: 8px 12px;
      background: rgba(255,255,255,0.05);
      color: var(--muted);
      border: 1px solid var(--border);
      border-radius: 6px;
      cursor: pointer;
      font-size: 12px;
      transition: all 0.2s;
    }
    
    .property-btn:hover {
      background: rgba(255,255,255,0.1);
      color: #fff;
    }
    
    .property-btn.small {
      padding: 6px 10px;
      font-size: 11px;
    }
    
    .property-btn.danger {
      background: rgba(239, 68, 68, 0.2);
      border-color: rgba(239, 68, 68, 0.3);
      color: #ef4444;
    }
    
    .property-btn.danger:hover {
      background: rgba(239, 68, 68, 0.3);
    }
    
    .apply-btn, .cancel-btn, .copy-btn {
      padding: 10px;
      border: none;
      border-radius: 6px;
      cursor: pointer;
      font-family: inherit;
      font-weight: 500;
      transition: all 0.2s;
      width: 100%;
      margin-top: 5px;
    }
    
    .apply-btn {
      background: var(--accent);
      color: white;
    }
    
    .apply-btn:hover {
      background: var(--accent-hover);
    }
    
    .cancel-btn {
      background: rgba(255,255,255,0.05);
      color: var(--muted);
      border: 1px solid var(--border);
    }
    
    .cancel-btn:hover {
      background: rgba(255,255,255,0.1);
    }
    
    .copy-btn {
      background: #10b981;
      color: white;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
    }
    
    .copy-btn:hover {
      background: #0da271;
    }
    
    .css-output {
      margin-top: 20px;
      padding-top: 20px;
      border-top: 1px solid var(--border);
    }
    
    .css-output h4 {
      margin: 0 0 10px 0;
      color: var(--accent);
      font-size: 14px;
    }
    
    #cssCodeOutput {
      background: rgba(0,0,0,0.2);
      border: 1px solid var(--border);
      border-radius: 6px;
      padding: 12px;
      font-family: 'Courier New', monospace;
      font-size: 12px;
      color: #e6eef6;
      white-space: pre-wrap;
      word-break: break-all;
      max-height: 300px;
      overflow-y: auto;
      margin-bottom: 10px;
    }
    
    .css-preview {
      margin-top: 15px;
      padding-top: 15px;
      border-top: 1px solid var(--border);
    }
    
    .preview-box {
      width: 100%;
      height: 100px;
      background: #ffffff;
      border: 1px solid var(--border);
      border-radius: 6px;
      margin-top: 10px;
    }
    
    /* Gradient Editor Overlay */
    .gradient-editor-overlay {
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: rgba(0,0,0,0.7);
      z-index: 1000;
      display: flex;
      align-items: center;
      justify-content: center;
      animation: fadeIn 0.3s ease;
    }
    
    .gradient-editor {
      background: var(--panel);
      border: 1px solid var(--border);
      border-radius: 12px;
      width: 500px;
      max-width: 90vw;
      max-height: 90vh;
      overflow-y: auto;
      box-shadow: 0 20px 60px rgba(0,0,0,0.5);
    }
    
    .gradient-preview {
      width: 100%;
      height: 100px;
      border-radius: 8px;
      margin: 20px;
      border: 1px solid var(--border);
    }
    
    .gradient-controls {
      padding: 0 20px 20px 20px;
    }
    
    .control-row {
      display: flex;
      align-items: center;
      gap: 10px;
      margin-bottom: 15px;
    }
    
    .control-row label {
      min-width: 60px;
      color: var(--muted);
      font-size: 13px;
    }
    
    .control-row select, .control-row input[type="range"] {
      flex: 1;
    }
    
    .color-stops-container {
      margin: 20px 0;
      padding: 15px;
      background: rgba(255,255,255,0.03);
      border-radius: 8px;
    }
    
    .color-stops-container h4 {
      margin: 0 0 15px 0;
      color: var(--accent);
      font-size: 14px;
    }
    
    .color-stop-item {
      display: flex;
      align-items: center;
      gap: 10px;
      margin-bottom: 10px;
    }
    
    .color-stop-item input[type="color"] {
      width: 30px;
      height: 30px;
      border: 1px solid var(--border);
      border-radius: 4px;
      background: none;
      cursor: pointer;
    }
    
    .color-stop-item input[type="range"] {
      flex: 1;
    }
    
    .stop-percent {
      min-width: 40px;
      font-size: 12px;
      color: var(--muted);
      text-align: center;
    }
    
    .remove-stop {
      background: rgba(239, 68, 68, 0.2);
      border: 1px solid rgba(239, 68, 68, 0.3);
      color: #ef4444;
      width: 24px;
      height: 24px;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      font-size: 16px;
      transition: all 0.2s;
    }
    
    .remove-stop:hover:not(:disabled) {
      background: rgba(239, 68, 68, 0.3);
    }
    
    .remove-stop:disabled {
      opacity: 0.3;
      cursor: not-allowed;
    }
    
    .add-stop-btn {
      width: 100%;
      padding: 10px;
      background: rgba(255,255,255,0.05);
      border: 1px solid var(--border);
      border-radius: 6px;
      color: var(--muted);
      cursor: pointer;
      margin-top: 10px;
      transition: all 0.2s;
    }
    
    .add-stop-btn:hover {
      background: rgba(255,255,255,0.1);
      color: #fff;
    }
    
    .editor-actions {
      display: flex;
      gap: 10px;
      margin-top: 20px;
    }
    
    @keyframes fadeIn {
      from { opacity: 0; }
      to { opacity: 1; }
    }
    
    /* Make sure inspector doesn't overlap with component panel */
    @media (max-width: 1400px) {
      .css-inspector {
        right: 20px;
      }
    }
  `;
  document.head.appendChild(style);
}

// 7. ADD TO YOUR EXISTING INITIALIZATION
// In your DOMContentLoaded event listener, add:
document.addEventListener('DOMContentLoaded', function() {
  // ... your existing initialization code ...
  
  // Initialize CSS Design System
  initCSSDesignSystem();
  
  // ... rest of your code ...
});



// document.addEventListener("DOMContentLoaded", () => {
//     setTimeout(() => {
//         if (window.currentChatId && window.loadChatData) {
//             console.log("Restoring chat:", window.currentChatId);
//             loadChatData();
//         }
//     }, 500);

// });

document.addEventListener("keydown", (e) => {
    if (e.ctrlKey && e.key === "z") undo();
    if (e.ctrlKey && e.key === "y") redo();
});




// ================= Properties Inspector & Tokens Integration ================
// Requires: canvas (fabric.Canvas already created) and components system already present

