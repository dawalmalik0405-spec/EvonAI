// component.js — Organized with CSS Design Components

(function (global) {
  if (!global.fabric) {
    console.warn('component.js: fabric missing — load Fabric before this file');
    return;
  }

  // ------------------------------------------------------------------
  // Registry
  // ------------------------------------------------------------------
  const ComponentRegistry = {
    items: {},
    register(id, category, title, builder) { 
      this.items[id] = { id, category, title, builder }; 
    },
    list() { return Object.values(this.items); },
    get(id) { return this.items[id]; }
  };

  // ------------------------------------------------------------------
  // Helper to create objects with preserved styles
  // ------------------------------------------------------------------
  function makeRect(w, h, opts = {}) {
    const rect = new fabric.Rect({
      left: 0, 
      top: 0, 
      width: w, 
      height: h, 
      rx: opts.rx || 6, 
      ry: opts.ry || 6, 
      fill: opts.fill || '#ffffff', 
      stroke: opts.stroke || '#e5e7eb', 
      strokeWidth: opts.strokeWidth || 1,
      originX: 'left',
      originY: 'top',
      selectable: opts.selectable ?? false,
      evented: opts.evented ?? false,
      objectCaching: false,
      hasControls: opts.deepEditable ? true : false,
      hasBorders: opts.deepEditable ? true : false,
    });
    
    return rect;
  }

  function makeText(txt, opts = {}) {
    const text = new fabric.IText(txt, {
      left: 0, 
      top: 0, 
      fontSize: opts.fontSize || 14, 
      fill: opts.fill || '#111827', 
      originX: 'left', 
      originY: 'top',
      selectable: opts.selectable ?? false,
      evented: opts.evented ?? false,
      editable: opts.editable ?? false,
      objectCaching: false,
      hasControls: opts.deepEditable ? true : false,
      hasBorders: opts.deepEditable ? true : false,
    });
    
    return text;
  }

  function makeCircle(r, opts = {}) {
    const circle = new fabric.Circle({
      left: 0,
      top: 0,
      radius: r,
      fill: opts.fill || '#ffffff',
      stroke: opts.stroke || '#e5e7eb',
      strokeWidth: opts.strokeWidth || 1,
      originX: 'center',
      originY: 'center',
      selectable: opts.selectable ?? false,
      evented: opts.evented ?? false,
      objectCaching: false,
      hasControls: opts.deepEditable ? true : false,
      hasBorders: opts.deepEditable ? true : false,
    });
    
    return circle;
  }

  // ------------------------------------------------------------------
  // Enhanced group creation with proper selection
  // ------------------------------------------------------------------
  function createComponentGroup(children, opts = {}) {
    // Calculate total bounds of all children
    let minLeft = Infinity, minTop = Infinity;
    let maxRight = -Infinity, maxBottom = -Infinity;
    
    children.forEach(child => {
      if (child.set) {
        // Ensure children are not selectable individually
        child.set({
          originX: 'left',
          originY: 'top',
          selectable: opts.deepEditable ? true : false,
          evented: opts.deepEditable ? true : false,
          targetFindTolerance: 5,
          hasControls: opts.deepEditable ? true : false,
          hasBorders: opts.deepEditable ? true : false,
          hoverCursor: opts.deepEditable ? 'pointer' : 'default'
        });

        // 🔥 Allow inner child to move/resize when deepEditable
        if (opts.deepEditable) {
          child.lockMovementX = false;
          child.lockMovementY = false;
          child.hoverCursor = 'move';
          child.movable = true;
          child.lockScalingX = false;
          child.lockScalingY = false;
          child.lockRotation = false;
        }
        
        // Calculate bounds
        const left = child.left || 0;
        const top = child.top || 0;
        let width, height;
        
        if (child.type === 'circle') {
          width = height = (child.radius || 0) * 2;
        } else {
          width = child.width * (child.scaleX || 1) || 0;
          height = child.height * (child.scaleY || 1) || 0;
        }
        
        minLeft = Math.min(minLeft, left);
        minTop = Math.min(minTop, top);
        maxRight = Math.max(maxRight, left + width);
        maxBottom = Math.max(maxBottom, top + height);
      }
    });
    
    // Normalize positions so group starts at (0,0)
    if (minLeft !== 0 || minTop !== 0) {
      children.forEach(child => {
        child.left -= minLeft;
        child.top -= minTop;
        child.setCoords && child.setCoords();
      });
      
      maxRight -= minLeft;
      maxBottom -= minTop;
    }
    
    const groupWidth = Math.max(1, maxRight);
    const groupHeight = Math.max(1, maxBottom);
    
    // Create the group - IMPORTANT: Ensure it's selectable
    const group = new fabric.Group(children, {
      left: opts.left || 100,
      top: opts.top || 100,
      width: groupWidth,
      height: groupHeight,
      selectable: true, // MUST BE TRUE
      hasControls: true, // MUST BE TRUE
      hasBorders: true, // MUST BE TRUE
      subTargetCheck: opts.deepEditable ? true : false, // Disable deep selection
      evented: opts.deepEditable ? false : true,
      objectCaching: false,
      perPixelTargetFind: true, // Helps with selection
      lockUniScaling: false,
      lockScalingX: false,
      lockScalingY: false,
      lockRotation: false,
      borderColor: '#4e9eff',
      cornerColor: '#ffffff',
      transparentCorners: false,
      cornerSize: 12,
      padding: 6
    });

    if (opts.deepEditable) {
      group.set({
        selectable: false,     // Do NOT select whole template on click
        evented: true,
        hasControls: true,
        hasBorders: true,
        lockMovementX: true,
        lockMovementY: true
      });
      group.on('mousedown', function (e) {
        if (e.subTargets && e.subTargets.length > 0) {
          const child = e.subTargets[0];
          global.canvas.setActiveObject(child);
        }
      });
    }
    
    // 🔥 Allow click-through selection for templates
    if (opts.deepEditable) {
      group.on('mousedown', function (e) {
        // Allow children to receive events
          e.preventDefault = true;
          e.stopPropagation = false;
        });
      }

    // Store component metadata
    group.componentId = opts.componentId || 'component';
    group.componentType = opts.componentType || 'custom';
    group._componentProps = opts.props || {};
    
    // Store original child positions relative to group
    group._childPositions = children.map(child => ({
      left: child.left || 0,
      top: child.top || 0,
      width: child.width || 0,
      height: child.height || 0,
      radius: child.radius || 0,
      type: child.type
    }));

    // Handle scaling
    let isScaling = false;
    
    group.on('scaling', function() {
      isScaling = true;
    });

    group.on('scaled', function() {
      if (!isScaling) return;
      
      const scaleX = group.scaleX;
      const scaleY = group.scaleY;
      
      // Scale each child and update their positions
      group.getObjects().forEach((child, index) => {
        try {
          const originalPos = group._childPositions[index];
          if (originalPos) {
            // Scale the child's position
            child.left = originalPos.left * scaleX;
            child.top = originalPos.top * scaleY;
            
            // Scale dimensions based on type
            if (child.type === 'rect' || child.type === 'triangle') {
              child.scaleX = scaleX;
              child.scaleY = scaleY;
            } else if (child.type === 'circle') {
              child.radius = (originalPos.radius || 0) * Math.min(scaleX, scaleY);
            }
            
            // For text, keep position but not font size
            if (child.type === 'i-text' || child.type === 'text') {
              child.left = originalPos.left * scaleX;
              child.top = originalPos.top * scaleY;
            }
            
            child.setCoords();
          }
        } catch (e) {
          console.warn('Error scaling child:', e);
        }
      });
      
      // Update group dimensions
      group.width = groupWidth * scaleX;
      group.height = groupHeight * scaleY;
      
      // Reset group scale
      group.scaleX = 1;
      group.scaleY = 1;
      
      group.setCoords();
      isScaling = false;
      
      if (global.canvas) {
        global.canvas.requestRenderAll();
      }
    });

    // Ensure children stay in place when group is moved
    group.on('moving', function() {
      if (!opts.deepEditable) {
          group.getObjects().forEach((child, index) => {
            const originalPos = group._childPositions[index];
            if (originalPos && (child.left !== originalPos.left || child.top !== originalPos.top)) {
              child.left = originalPos.left;
              child.top = originalPos.top;
              child.setCoords();
            }
          });
      }
    });

    // Handle modifications - ensure group remains selectable
   group.on('modified', function() {
  // Templates do NOT restore children
      if (opts.deepEditable) return;

      group.set({
        selectable: true,
        hasControls: true,
        hasBorders: true,
        evented: true
      });

      group.getObjects().forEach((child, index) => {
        const originalPos = group._childPositions[index];
        if (originalPos && (child.left !== originalPos.left || child.top !== originalPos.top)) {
          child.left = originalPos.left;
          child.top = originalPos.top;
          child.setCoords();
        }
      });

      
      if (global.canvas) {
        global.canvas.requestRenderAll();
      }
    });

    // When added to canvas, ensure it's properly selectable
    group.on('added', function() {
      // Apply main script's resizable behavior
      if (typeof makeObjectResizable === 'function') {
        // Don't override the group's properties
        group.set({
          selectable: true,
          hasControls: true,
          hasBorders: true,
          evented: true
        });
      }
    });

    // Double-click to edit text
    group.on('mousedblclick', function(options) {
      if (options.target === group) {
        const textObjects = group.getObjects().filter(obj => 
          obj.type === 'i-text' || obj.type === 'text'
        );
        
        if (textObjects.length > 0) {
          const textObj = textObjects[0];
          // Temporarily enable editing
          textObj.set({
            selectable: true,
            evented: true,
            editable: true
          });
          
          if (global.canvas) {
            global.canvas.setActiveObject(textObj);
            textObj.enterEditing();
            textObj.selectAll();

            if (!opts.deepEditable) {
              textObj.on('editing:exited', function() {
                textObj.set({
                  selectable: false,
                  evented: false,
                  editable: false
                });
                global.canvas.setActiveObject(group);
                global.canvas.requestRenderAll();
              });
            }
            
            global.canvas.requestRenderAll();
          }
        }
      }
    });

    return group;
  }

  // ------------------------------------------------------------------
  // FIXED: Line helper function (was missing)
  // ------------------------------------------------------------------
  function makeLine(points, opts = {}) {
    const line = new fabric.Line(points, {
      stroke: opts.stroke || '#e5e7eb',
      strokeWidth: opts.strokeWidth || 1,
      selectable: false,
      evented: false,
      objectCaching: false,
      hasControls: false,
      hasBorders: false
    });
    
    return line;
  }

  // ------------------------------------------------------------------
  // COMPONENT BUILDERS (all with proper selection)
  // ------------------------------------------------------------------

  // ===== BUTTONS =====
  function createFilledButton(label = 'Button', opts = {}) {
    const fontSize = opts.fontSize || 14;
    const paddingH = 20;
    const paddingV = 10;
    
    const text = makeText(label, { 
      fontSize: fontSize,
      fill: opts.textColor || '#ffffff'
    });
    
    const textWidth = label.length * fontSize * 0.6;
    const textHeight = fontSize;
    const width = Math.max(80, textWidth + paddingH * 2);
    const height = textHeight + paddingV * 2;
    
    const rect = makeRect(width, height, {
      fill: opts.fill || '#0078ff',
      stroke: 'transparent',
      rx: 8,
      ry: 8
    });
    
    text.left = (width - textWidth) / 2;
    text.top = (height - textHeight) / 2;
    
    return createComponentGroup([rect, text], {
      componentId: 'button.filled',
      componentType: 'button',
      props: {
        label: label,
        fill: opts.fill || '#0078ff',
        textColor: opts.textColor || '#ffffff'
      }
    });
  }

  function createOutlineButton(label = 'Button', opts = {}) {
    const fontSize = opts.fontSize || 14;
    const paddingH = 20;
    const paddingV = 10;
    
    const text = makeText(label, { 
      fontSize: fontSize,
      fill: opts.textColor || '#0078ff'
    });
    
    const textWidth = label.length * fontSize * 0.6;
    const textHeight = fontSize;
    const width = Math.max(80, textWidth + paddingH * 2);
    const height = textHeight + paddingV * 2;
    
    const rect = makeRect(width, height, {
      fill: 'transparent',
      stroke: opts.stroke || '#0078ff',
      strokeWidth: 2,
      rx: 8,
      ry: 8
    });
    
    text.left = (width - textWidth) / 2;
    text.top = (height - textHeight) / 2;
    
    return createComponentGroup([rect, text], {
      componentId: 'button.outline',
      componentType: 'button',
      props: {
        label: label,
        stroke: opts.stroke || '#0078ff',
        textColor: opts.textColor || '#0078ff'
      }
    });
  }

  function createIconButton(icon = '⭐', label = 'Button', opts = {}) {
    const fontSize = opts.fontSize || 14;
    const paddingH = 20;
    const paddingV = 10;
    const iconSize = fontSize + 4;
    
    const iconText = makeText(icon, {
      fontSize: iconSize,
      fill: opts.iconColor || '#ffffff'
    });
    
    const labelText = makeText(label, {
      fontSize: fontSize,
      fill: opts.textColor || '#ffffff'
    });
    
    const iconWidth = iconSize;
    const labelWidth = label.length * fontSize * 0.6;
    const spacing = 8;
    const width = Math.max(100, iconWidth + spacing + labelWidth + paddingH * 2);
    const height = Math.max(iconSize, fontSize) + paddingV * 2;
    
    const rect = makeRect(width, height, {
      fill: opts.fill || '#0078ff',
      stroke: 'transparent',
      rx: 8,
      ry: 8
    });
    
    iconText.left = paddingH;
    iconText.top = (height - iconSize) / 2;
    
    labelText.left = paddingH + iconWidth + spacing;
    labelText.top = (height - fontSize) / 2;
    
    return createComponentGroup([rect, iconText, labelText], {
      componentId: 'button.icon',
      componentType: 'button',
      props: {
        icon: icon,
        label: label,
        fill: opts.fill || '#0078ff',
        textColor: opts.textColor || '#ffffff'
      }
    });
  }

  function createSmallButton(label = 'Small', opts = {}) {
    const fontSize = opts.fontSize || 12;
    const paddingH = 12;
    const paddingV = 6;
    
    const text = makeText(label, { 
      fontSize: fontSize,
      fill: opts.textColor || '#ffffff'
    });
    
    const textWidth = label.length * fontSize * 0.6;
    const width = Math.max(60, textWidth + paddingH * 2);
    const height = fontSize + paddingV * 2;
    
    const rect = makeRect(width, height, {
      fill: opts.fill || '#6b7280',
      stroke: 'transparent',
      rx: 6,
      ry: 6
    });
    
    text.left = (width - textWidth) / 2;
    text.top = (height - fontSize) / 2;
    
    return createComponentGroup([rect, text], {
      componentId: 'button.small',
      componentType: 'button',
      props: {
        label: label,
        fill: opts.fill || '#6b7280',
        textColor: opts.textColor || '#ffffff'
      }
    });
  }

  // ----------------------
  // Apple-style Buttons (soft, premium)
  // ----------------------
  function _appleButtonBase(label, opts = {}) {
    const fontSize = opts.fontSize || 15;
    const paddingH = opts.paddingH ?? 20;
    const paddingV = opts.paddingV ?? 10;
    const radius = opts.radius ?? 10;

    // base rect (soft gradient simulated by two layered rects)
    const base = makeRect(1, 1, {
      fill: opts.fill || '#007aff',
      stroke: opts.stroke || 'rgba(0,0,0,0.04)',
      strokeWidth: opts.strokeWidth || 1,
      rx: radius, ry: radius
    });

    // subtle highlight overlay (top gloss)
    const sheen = makeRect(1, 1, {
      fill: 'rgba(255,255,255,0.08)',
      rx: radius, ry: radius,
      selectable: false, evented: false, objectCaching: false
    });

    // inner subtle shadow (rounded inset effect)
    const shadow = makeRect(1, 1, {
      fill: 'rgba(0,0,0,0.03)',
      rx: radius, ry: radius,
      selectable: false, evented: false, objectCaching: false
    });

    // text
    const text = makeText(label, {
      fontSize: fontSize,
      fill: opts.textColor || '#ffffff'
    });

    // compute measured sizes (approximate if Fabric dimensions not ready)
    const measuredW = Math.max(80, (label.length * fontSize * 0.6) + paddingH * 2);
    const measuredH = fontSize + paddingV * 2;

    base.width = measuredW; base.height = measuredH;
    sheen.width = measuredW; sheen.height = Math.round(measuredH * 0.45);
    sheen.top = 0; sheen.left = 0;
    shadow.width = measuredW; shadow.height = measuredH;
    shadow.top = 0; shadow.left = 0;

    text.left = (measuredW - (label.length * fontSize * 0.6)) / 2;
    text.top = (measuredH - fontSize) / 2;

    // place objects in order (shadow, base, sheen, text)
    const group = createComponentGroup([shadow, base, sheen, text], {
      componentId: opts.componentId || 'button.appleBase',
      props: Object.assign({}, opts.props || {}, { label })
    });

    // set intrinsic size for convenience
    group.width = measuredW;
    group.height = measuredH;

    return group;
  }

  function createApplePrimaryButton(label = 'Get Started', opts = {}) {
    opts.fill = opts.fill || '#007aff'; // Apple blue
    opts.textColor = opts.textColor || '#ffffff';
    opts.componentId = 'button.applePrimary';
    return _appleButtonBase(label, opts);
  }

  function createAppleSecondaryButton(label = 'Learn More', opts = {}) {
    opts.fill = opts.fill || '#f1f5f9'; // soft gray
    opts.textColor = opts.textColor || '#0f172a';
    opts.stroke = opts.stroke || 'rgba(0,0,0,0.06)';
    opts.componentId = 'button.appleSecondary';
    return _appleButtonBase(label, opts);
  }

  function createAppleGhostButton(label = 'More', opts = {}) {
    // transparent background, subtle border
    opts.fill = opts.fill || 'transparent';
    opts.textColor = opts.textColor || '#0f172a';
    opts.stroke = opts.stroke || 'rgba(15,23,42,0.08)';
    opts.componentId = 'button.appleGhost';
    return _appleButtonBase(label, opts);
  }

  function createApplePillButton(label = 'Continue', opts = {}) {
    opts.radius = opts.radius || 999;
    opts.fill = opts.fill || '#007aff';
    opts.textColor = opts.textColor || '#fff';
    opts.componentId = 'button.applePill';
    return _appleButtonBase(label, opts);
  }

  // ----------------------
  // Full-page Template builders
  // ----------------------
  function buildLandingTemplate(opts = {}) {
    const w = opts.width || 1000;
    const padding = 32;

    // Background canvas area for template (in-group background)
    const bg = makeRect(w, 680, { fill: '#ffffff', stroke: '#e6edf3', rx: 0, ry: 0 });
    bg._isBackground = true; // keep AutoLayout skipping logic if used

    // NAVBAR
    const logo = makeText('Brand', { fontSize: 18, fill: '#0f172a' });
    logo.left = padding;
    logo.top = 24;

    const navButton = createAppleGhostButton('Sign In');
    navButton.left = w - 140;
    navButton.top = 14;

    // HERO
    const heroTitle = makeText('Create beautiful products', { fontSize: 34, fill: '#0f172a' });
    heroTitle.left = padding;
    heroTitle.top = 100;

    const heroSub = makeText('Design-to-code generator for fast web builds', { fontSize: 16, fill: '#374151' });
    heroSub.left = padding;
    heroSub.top = 150;

    const cta = createApplePrimaryButton('Get Started');
    cta.left = padding;
    cta.top = 200;

    // Features row — three cards
    const card1 = createCard('Fast', 'Convert designs to working code quickly', { width: 260 });
    card1.left = padding;
    card1.top = 320;

    const card2 = createCard('Flexible', 'Edit exported code or rebuild visually', { width: 260 });
    card2.left = padding + 280;
    card2.top = 320;

    const card3 = createCard('Scalable', 'Designed for teams and production', { width: 260 });
    card3.left = padding + 560;
    card3.top = 320;

    // Footer
    const footer = makeRect(w, 88, { fill: '#f8fafc', stroke: 'transparent' });
    footer.left = 0;
    footer.top = 592;

    const footerText = makeText('© Your Company', { fontSize: 13, fill: '#6b7280' });
    footerText.left = padding;
    footerText.top = 612;

    const group = createComponentGroup([
      bg, logo, navButton, heroTitle, heroSub, cta,
      card1, card2, card3, footer, footerText
    ], {
      componentId: 'template.landingPage',
      componentType: 'template',
      deepEditable: true,
      props: { width: w, height: 680, name: 'Landing Page' }
    });

    // set canonical size
    group.width = w;
    group.height = 680;
    return group;
  }

  function buildLoginTemplate(opts = {}) {
    const w = opts.width || 680;
    const h = opts.height || 520;
    const bg = makeRect(w, h, { fill: '#ffffff', stroke: '#e6edf3' });
    bg._isBackground = true;

    const title = makeText('Welcome back', { fontSize: 24, fill: '#0f172a' });
    title.left = 40; title.top = 40;

    const cardRect = makeRect(420, 320, { fill: '#ffffff', stroke: '#e6edf3', rx: 12 });
    cardRect.left = (w - 420) / 2; cardRect.top = 100;

    const email = createTextField('Email');
    email.left = cardRect.left + 20; email.top = cardRect.top + 28;

    const pwd = createTextField('Password');
    pwd.left = email.left; pwd.top = email.top + 56;

    const loginBtn = createApplePrimaryButton('Sign in');
    loginBtn.left = cardRect.left + 20; loginBtn.top = pwd.top + 80;

    const footerText = makeText('Forgot password?', { fontSize: 13, fill: '#6b7280' });
    footerText.left = cardRect.left + 20; footerText.top = loginBtn.top + 56;

    const group = createComponentGroup([bg, title, cardRect, email, pwd, loginBtn, footerText], {
      componentId: 'template.login',
      componentType: 'template',
      deepEditable: true,
      props: { width: w, height: h, name: 'Login Page' }
    });

    group.width = w; group.height = h;
    return group;
  }

  function buildProductPageTemplate(opts = {}) {
    const w = opts.width || 980;
    const h = 720;
    const bg = makeRect(w, h, { fill: '#ffffff' }); bg._isBackground = true;

    const brand = makeText('Brand', { fontSize: 18, fill: '#0f172a' }); brand.left = 28; brand.top = 20;
    const productTitle = makeText('Product Name', { fontSize: 28, fill: '#0f172a' }); productTitle.left = 28; productTitle.top = 120;
    const price = makeText('$49.99', { fontSize: 22, fill: '#007aff' }); price.left = 28; price.top = 170;

    // placeholder image
    const imgRect = makeRect(420, 300, { fill: '#e9eef6', stroke: '#dbe9ff' });
    imgRect.left = 520; imgRect.top = 100;
    const imgText = makeText('Product Image', { fontSize: 14, fill: '#6b7280' });
    imgText.left = imgRect.left + 24; imgText.top = imgRect.top + 24;

    const buyBtn = createApplePrimaryButton('Add to Cart');
    buyBtn.left = 28; buyBtn.top = 220;

    const group = createComponentGroup([bg, brand, productTitle, price, imgRect, imgText, buyBtn], {
      componentId: 'template.productPage',
      componentType: 'template',
      deepEditable: true,
      props: { width: w, height: h, name: 'Product Page' }
    });

    group.width = w; group.height = h;
    return group;
  }

  // Additional template builders
  function buildDashboardTemplate(opts = {}) {
    const w = opts.width || 1000;
    const h = 800;
    const bg = makeRect(w, h, { fill: '#f8fafc' });
    bg._isBackground = true;

    // Sidebar
    const sidebar = makeRect(240, h, { fill: '#ffffff', stroke: '#e6edf3' });
    sidebar.left = 0;
    sidebar.top = 0;

    const sidebarTitle = makeText('Dashboard', { fontSize: 18, fill: '#0f172a', fontWeight: 'bold' });
    sidebarTitle.left = 20;
    sidebarTitle.top = 30;

    // Main content
    const header = makeRect(w - 240, 80, { fill: '#ffffff', stroke: '#e6edf3' });
    header.left = 240;
    header.top = 0;

    const stats = createCard('Total Revenue', '$24,580', { width: 200 });
    stats.left = 260;
    stats.top = 100;

    const stats2 = createCard('New Users', '+1,240', { width: 200 });
    stats2.left = 480;
    stats2.top = 100;

    const chart = makeRect(500, 300, { fill: '#ffffff', stroke: '#e6edf3', rx: 8 });
    chart.left = 260;
    chart.top = 200;

    const group = createComponentGroup([
      bg, sidebar, sidebarTitle, header, stats, stats2, chart
    ], {
      componentId: 'template.dashboard',
      componentType: 'template',
      deepEditable: true,
      props: { width: w, height: h, name: 'Dashboard' }
    });

    group.width = w;
    group.height = h;
    return group;
  }

  // ===== INPUTS =====
  function createTextField(placeholder = 'Enter text...', opts = {}) {
    const width = opts.width || 200;
    const height = opts.height || 40;
    const fontSize = opts.fontSize || 14;
    
    const rect = makeRect(width, height, {
      fill: '#ffffff',
      stroke: '#d1d5db',
      strokeWidth: 1,
      rx: 6,
      ry: 6
    });
    
    const text = makeText(placeholder, {
      fontSize: fontSize,
      fill: '#6b7280',
      fontStyle: 'italic'
    });
    
    text.left = 12;
    text.top = (height - fontSize) / 2;
    
    return createComponentGroup([rect, text], {
      componentId: 'input.text',
      componentType: 'input',
      props: {
        placeholder: placeholder,
        width: width,
        height: height
      }
    });
  }

  function createTextArea(placeholder = 'Enter longer text...', opts = {}) {
    const width = opts.width || 240;
    const height = opts.height || 80;
    const fontSize = opts.fontSize || 14;
    
    const rect = makeRect(width, height, {
      fill: '#ffffff',
      stroke: '#d1d5db',
      strokeWidth: 1,
      rx: 6,
      ry: 6
    });
    
    const text = makeText(placeholder, {
      fontSize: fontSize,
      fill: '#6b7280',
      fontStyle: 'italic'
    });
    
    text.left = 12;
    text.top = 12;
    
    return createComponentGroup([rect, text], {
      componentId: 'input.textarea',
      componentType: 'input',
      props: {
        placeholder: placeholder,
        width: width,
        height: height
      }
    });
  }

  function createSearchField(placeholder = 'Search...', opts = {}) {
    const width = opts.width || 240;
    const height = opts.height || 40;
    const fontSize = opts.fontSize || 14;
    
    const rect = makeRect(width, height, {
      fill: '#ffffff',
      stroke: '#d1d5db',
      strokeWidth: 1,
      rx: 20,
      ry: 20
    });
    
    const searchIcon = makeText('🔍', {
      fontSize: fontSize,
      fill: '#6b7280'
    });
    
    const text = makeText(placeholder, {
      fontSize: fontSize,
      fill: '#6b7280',
      fontStyle: 'italic'
    });
    
    searchIcon.left = 12;
    searchIcon.top = (height - fontSize) / 2;
    
    text.left = 40;
    text.top = (height - fontSize) / 2;
    
    return createComponentGroup([rect, searchIcon, text], {
      componentId: 'input.search',
      componentType: 'input',
      props: {
        placeholder: placeholder,
        width: width,
        height: height
      }
    });
  }

  // ===== CARDS =====
  function createCard(title = 'Card Title', content = 'Card content goes here.', opts = {}) {
    const width = opts.width || 240;
    const padding = 16;
    
    const titleText = makeText(title, {
      fontSize: 16,
      fill: '#111827',
      fontWeight: 'bold'
    });
    
    const contentText = makeText(content, {
      fontSize: 14,
      fill: '#374151'
    });
    
    const titleHeight = 16;
    const contentHeight = 14;
    const cardHeight = padding * 2 + titleHeight + 8 + contentHeight;
    
    const rect = makeRect(width, cardHeight, {
      fill: '#ffffff',
      stroke: '#e5e7eb',
      strokeWidth: 1,
      rx: 8,
      ry: 8
    });
    
    titleText.left = padding;
    titleText.top = padding;
    
    contentText.left = padding;
    contentText.top = padding + titleHeight + 8;
    
    return createComponentGroup([rect, titleText, contentText], {
      componentId: 'card.simple',
      componentType: 'card',
      props: {
        title: title,
        content: content,
        width: width,
        height: cardHeight
      }
    });
  }

  function createCardWithImage(title = 'Product Card', price = '$29.99', opts = {}) {
    const width = opts.width || 200;
    const imageHeight = 120;
    const padding = 12;
    
    // Image placeholder
    const imageRect = makeRect(width, imageHeight, {
      fill: '#e5e7eb',
      stroke: '#d1d5db',
      strokeWidth: 1
    });
    
    // Image text overlay
    const imageText = makeText('📷 Image', {
      fontSize: 12,
      fill: '#6b7280'
    });
    imageText.left = width / 2 - 25;
    imageText.top = imageHeight / 2 - 6;
    
    // Title
    const titleText = makeText(title, {
      fontSize: 14,
      fill: '#111827',
      fontWeight: 'bold'
    });
    titleText.left = padding;
    titleText.top = imageHeight + padding;
    
    // Price
    const priceText = makeText(price, {
      fontSize: 16,
      fill: '#0078ff',
      fontWeight: 'bold'
    });
    priceText.left = width - padding - (price.length * 10);
    priceText.top = imageHeight + padding;
    
    // Button
    const buttonRect = makeRect(80, 32, {
      fill: '#0078ff',
      stroke: 'transparent',
      rx: 6,
      ry: 6
    });
    buttonRect.left = padding;
    buttonRect.top = imageHeight + padding + 20;
    
    const buttonText = makeText('Add to Cart', {
      fontSize: 12,
      fill: '#ffffff'
    });
    buttonText.left = padding + 10;
    buttonText.top = imageHeight + padding + 26;
    
    const totalHeight = imageHeight + padding * 2 + 20 + 32;
    
    const containerRect = makeRect(width, totalHeight, {
      fill: '#ffffff',
      stroke: '#e5e7eb',
      strokeWidth: 1,
      rx: 8,
      ry: 8
    });
    
    return createComponentGroup([
      containerRect, 
      imageRect, imageText,
      titleText, priceText,
      buttonRect, buttonText
    ], {
      componentId: 'card.product',
      componentType: 'card',
      props: {
        title: title,
        price: price,
        width: width,
        height: totalHeight
      }
    });
  }

  // ===== NAVIGATION =====
  function createNavbar(brand = 'Brand', opts = {}) {
    const width = opts.width || 400;
    const height = 60;
    const padding = 20;
    
    const navbarRect = makeRect(width, height, {
      fill: '#ffffff',
      stroke: '#e5e7eb',
      strokeWidth: 1
    });
    
    const brandText = makeText(brand, {
      fontSize: 18,
      fill: '#111827',
      fontWeight: 'bold'
    });
    brandText.left = padding;
    brandText.top = (height - 18) / 2;
    
    // Navigation items
    const navItems = ['Home', 'About', 'Services', 'Contact'];
    const navStartX = 120;
    const navSpacing = 60;
    
    const navElements = navItems.map((item, index) => {
      const text = makeText(item, {
        fontSize: 14,
        fill: '#374151'
      });
      text.left = navStartX + (index * navSpacing);
      text.top = (height - 14) / 2;
      return text;
    });
    
    // Button
    const buttonRect = makeRect(100, 36, {
      fill: '#0078ff',
      stroke: 'transparent',
      rx: 6,
      ry: 6
    });
    buttonRect.left = width - 120;
    buttonRect.top = (height - 36) / 2;
    
    const buttonText = makeText('Sign Up', {
      fontSize: 14,
      fill: '#ffffff'
    });
    buttonText.left = width - 120 + 20;
    buttonText.top = (height - 14) / 2;
    
    return createComponentGroup([
      navbarRect, 
      brandText, 
      ...navElements,
      buttonRect, 
      buttonText
    ], {
      componentId: 'nav.basic',
      componentType: 'navigation',
      props: {
        brand: brand,
        width: width,
        height: height
      }
    });
  }

  // ===== HEADERS =====
  function createHeroHeader(title = 'Welcome to Our Platform', subtitle = 'Build amazing things with our tools', opts = {}) {
    const width = opts.width || 400;
    const padding = 40;
    
    const titleText = makeText(title, {
      fontSize: 24,
      fill: '#111827',
      fontWeight: 'bold'
    });
    
    const subtitleText = makeText(subtitle, {
      fontSize: 16,
      fill: '#374151'
    });
    
    const buttonRect = makeRect(140, 44, {
      fill: '#0078ff',
      stroke: 'transparent',
      rx: 8,
      ry: 8
    });
    
    const buttonText = makeText('Get Started', {
      fontSize: 16,
      fill: '#ffffff'
    });
    
    const titleWidth = title.length * 12;
    const subtitleWidth = subtitle.length * 8;
    const maxTextWidth = Math.max(titleWidth, subtitleWidth);
    const contentWidth = Math.max(width, maxTextWidth + padding * 2);
    
    const totalHeight = padding * 2 + 24 + 16 + 20 + 44;
    
    const containerRect = makeRect(contentWidth, totalHeight, {
      fill: '#f9fafb',
      stroke: '#e5e7eb',
      strokeWidth: 1,
      rx: 12,
      ry: 12
    });
    
    titleText.left = (contentWidth - titleWidth) / 2;
    titleText.top = padding;
    
    subtitleText.left = (contentWidth - subtitleWidth) / 2;
    subtitleText.top = padding + 24 + 8;
    
    buttonRect.left = (contentWidth - 140) / 2;
    buttonRect.top = padding + 24 + 16 + 20;
    
    buttonText.left = (contentWidth - 70) / 2;
    buttonText.top = padding + 24 + 16 + 20 + 12;
    
    return createComponentGroup([
      containerRect,
      titleText,
      subtitleText,
      buttonRect,
      buttonText
    ], {
      componentId: 'header.hero',
      componentType: 'header',
      props: {
        title: title,
        subtitle: subtitle,
        width: contentWidth,
        height: totalHeight
      }
    });
  }

  // ===== ICONS =====
  function createIcon(icon = '⭐', label = '', opts = {}) {
    const size = opts.size || 40;
    const fontSize = Math.floor(size * 0.6);
    
    const circle = makeCircle(size / 2, {
      fill: opts.fill || '#0078ff',
      stroke: opts.stroke || 'transparent',
      strokeWidth: opts.strokeWidth || 0
    });
    circle.left = size / 2;
    circle.top = size / 2;
    
    const iconText = makeText(icon, {
      fontSize: fontSize,
      fill: opts.iconColor || '#ffffff'
    });
    iconText.left = size / 2 - fontSize * 0.3;
    iconText.top = size / 2 - fontSize * 0.5;
    
    const elements = [circle, iconText];
    
    if (label) {
      const labelText = makeText(label, {
        fontSize: 12,
        fill: opts.labelColor || '#374151'
      });
      labelText.left = (size - (label.length * 7)) / 2;
      labelText.top = size + 4;
      elements.push(labelText);
    }
    
    const groupWidth = size;
    const groupHeight = label ? size + 20 : size;
    
    const group = createComponentGroup(elements, {
      componentId: 'icon.basic',
      componentType: 'icon',
      props: {
        icon: icon,
        label: label,
        size: size
      }
    });
    
    group.width = groupWidth;
    group.height = groupHeight;
    
    return group;
  }

  // ===== LAYOUT ELEMENTS =====
  function createContainer(width = 300, height = 200, opts = {}) {
    const rect = makeRect(width, height, {
      fill: opts.fill || '#f9fafb',
      stroke: opts.stroke || '#e5e7eb',
      strokeWidth: opts.strokeWidth || 1,
      rx: opts.rx || 8,
      ry: opts.ry || 8
    });
    
    const label = makeText(opts.label || 'Container', {
      fontSize: 12,
      fill: '#6b7280',
      fontStyle: 'italic'
    });
    label.left = 10;
    label.top = 10;
    
    return createComponentGroup([rect, label], {
      componentId: 'layout.container',
      componentType: 'layout',
      props: {
        width: width,
        height: height,
        label: opts.label || 'Container'
      }
    });
  }

  function createDivider(width = 300, opts = {}) {
    const line = makeLine([0, 0, width, 0], {
      stroke: opts.stroke || '#e5e7eb',
      strokeWidth: opts.strokeWidth || 1
    });
    
    // For divider, we need to adjust the position since line is centered
    line.left = width / 2;
    line.top = 0;
    
    const group = createComponentGroup([line], {
      componentId: 'layout.divider',
      componentType: 'layout',
      props: {
        width: width
      }
    });
    
    // Set proper dimensions for divider
    group.width = width;
    group.height = 1;
    
    return group;
  }

  // ==================== CSS DESIGN TOOLS ====================

  // 1. GRADIENT GENERATOR
  function createGradientTool() {
    const gradientPreview = makeRect(200, 120, {
      fill: 'linear-gradient(90deg, #0078ff, #00c6ff)',
      stroke: 'transparent'
    });
    
    const title = makeText('Gradient Preview', {
      fontSize: 14,
      fill: '#ffffff',
      textAlign: 'center',
      fontWeight: 'bold'
    });
    title.left = 100;
    title.top = 50;
    
    const group = createComponentGroup([gradientPreview, title], {
      componentId: 'tool.gradient',
      componentType: 'tool',
      props: {
        isGradientTool: true,
        gradientType: 'linear',
        colors: ['#0078ff', '#00c6ff'],
        angle: 90
      }
    });
    
    // Make it open gradient editor on click
    group.on('mousedown', function() {
      if (global.canvas) {
        openGradientEditor(group);
      }
    });
    
    return group;
  }

  // 2. BUTTON CREATOR WITH CSS
  function createCSSButton(label = 'Button', opts = {}) {
    const fontSize = opts.fontSize || 14;
    const paddingH = opts.paddingH || 20;
    const paddingV = opts.paddingV || 10;
    
    // Button with gradient background
    const buttonBg = makeRect(120, 40, {
      fill: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
      stroke: 'transparent',
      rx: 8,
      ry: 8
    });
    
    const buttonText = makeText(label, {
      fontSize: fontSize,
      fill: '#ffffff',
      fontWeight: 'bold'
    });
    buttonText.left = (120 - (label.length * fontSize * 0.6)) / 2;
    buttonText.top = (40 - fontSize) / 2;
    
    const group = createComponentGroup([buttonBg, buttonText], {
      componentId: 'button.css',
      componentType: 'button',
      deepEditable: true,
      props: {
        label: label,
        gradient: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        hoverEffect: true,
        cssProperties: {
          background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
          color: '#ffffff',
          borderRadius: '8px',
          padding: '10px 20px',
          border: 'none',
          cursor: 'pointer',
          transition: 'all 0.3s ease',
          boxShadow: '0 4px 6px rgba(50, 50, 93, 0.11), 0 1px 3px rgba(0, 0, 0, 0.08)'
        }
      }
    });
    
    return group;
  }

  // 3. SHADOW GENERATOR
  function createShadowTool() {
    const box = makeRect(120, 120, {
      fill: '#ffffff',
      stroke: '#e5e7eb',
      shadow: 'rgba(0, 0, 0, 0.1) 0px 4px 12px'
    });
    
    const title = makeText('Shadow Box', {
      fontSize: 12,
      fill: '#666',
      textAlign: 'center'
    });
    title.left = 60;
    title.top = 60;
    
    const group = createComponentGroup([box, title], {
      componentId: 'tool.shadow',
      componentType: 'tool',
      props: {
        isShadowTool: true,
        shadowColor: 'rgba(0, 0, 0, 0.1)',
        shadowX: 0,
        shadowY: 4,
        shadowBlur: 12
      }
    });
    
    return group;
  }

  // 4. TYPOGRAPHY TOOL
  function createTypographyTool() {
    const text = makeText('Typography', {
      fontSize: 24,
      fill: '#111827',
      fontFamily: 'Arial',
      fontWeight: 'bold',
      textAlign: 'center'
    });
    
    const group = createComponentGroup([text], {
      componentId: 'tool.typography',
      componentType: 'tool',
      props: {
        isTypographyTool: true,
        fontFamily: 'Arial',
        fontSize: 24,
        fontWeight: 'bold',
        color: '#111827'
      }
    });
    
    return group;
  }

  // 5. BORDER TOOL
  function createBorderTool() {
    const box = makeRect(120, 120, {
      fill: 'transparent',
      stroke: '#0078ff',
      strokeWidth: 3,
      rx: 16,
      ry: 16
    });
    
    const title = makeText('Border Style', {
      fontSize: 12,
      fill: '#666',
      textAlign: 'center'
    });
    title.left = 60;
    title.top = 60;
    
    const group = createComponentGroup([box, title], {
      componentId: 'tool.border',
      componentType: 'tool',
      props: {
        isBorderTool: true,
        borderWidth: 3,
        borderColor: '#0078ff',
        borderRadius: 16,
        borderStyle: 'solid'
      }
    });
    
    return group;
  }

  // 6. FLEXBOX CONTAINER
  function createFlexboxContainer() {
    const container = makeRect(240, 160, {
      fill: '#f3f4f6',
      stroke: '#d1d5db',
      rx: 8,
      ry: 8
    });
    
    const item1 = makeRect(40, 40, {
      fill: '#0078ff',
      stroke: 'transparent',
      rx: 4,
      ry: 4
    });
    item1.left = 20;
    item1.top = 60;
    
    const item2 = makeRect(40, 40, {
      fill: '#10b981',
      stroke: 'transparent',
      rx: 4,
      ry: 4
    });
    item2.left = 70;
    item2.top = 60;
    
    const item3 = makeRect(40, 40, {
      fill: '#f59e0b',
      stroke: 'transparent',
      rx: 4,
      ry: 4
    });
    item3.left = 120;
    item3.top = 60;
    
    const label = makeText('Flex Container', {
      fontSize: 12,
      fill: '#6b7280',
      textAlign: 'center'
    });
    label.left = 120;
    label.top = 20;
    
    const group = createComponentGroup([container, item1, item2, item3, label], {
      componentId: 'layout.flex',
      componentType: 'layout',
      deepEditable: true,
      props: {
        isFlexContainer: true,
        flexDirection: 'row',
        justifyContent: 'space-around',
        alignItems: 'center',
        gap: '10px'
      }
    });
    
    return group;
  }

  // 7. GRID CONTAINER
  function createGridContainer() {
    const container = makeRect(240, 160, {
      fill: '#f3f4f6',
      stroke: '#d1d5db',
      rx: 8,
      ry: 8
    });
    
    // Create grid items
    const items = [];
    const cols = 3;
    const rows = 2;
    const itemSize = 30;
    const gap = 10;
    
    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < cols; col++) {
        const item = makeRect(itemSize, itemSize, {
          fill: '#0078ff',
          stroke: 'transparent',
          rx: 4,
          ry: 4
        });
        item.left = 20 + col * (itemSize + gap);
        item.top = 40 + row * (itemSize + gap);
        items.push(item);
      }
    }
    
    const label = makeText('Grid Container', {
      fontSize: 12,
      fill: '#6b7280',
      textAlign: 'center'
    });
    label.left = 120;
    label.top = 15;
    
    const group = createComponentGroup([container, label, ...items], {
      componentId: 'layout.grid',
      componentType: 'layout',
      deepEditable: true,
      props: {
        isGridContainer: true,
        gridColumns: 3,
        gridRows: 2,
        gap: '10px'
      }
    });
    
    return group;
  }
  // ==================== ORGANIZED COMPONENT REGISTRY ====================

  const organizedComponents = {
    // 📝 BASIC ELEMENTS
    'basic': [
      {
        id: 'shape.rectangle',
        name: 'Rectangle',
        category: 'basic',
        description: 'Basic rectangle shape',
        icon: '⬛',
        builder: () => {
          const rect = new fabric.Rect({
            width: 100,
            height: 60,
            fill: '#ffffff',
            stroke: '#e5e7eb',
            strokeWidth: 1,
            rx: 6,
            ry: 6,
            selectable: true,
            hasControls: true
          });
          return rect;
        }
      },
      {
        id: 'shape.circle',
        name: 'Circle',
        category: 'basic',
        description: 'Circle shape',
        icon: '⚪',
        builder: () => {
          const circle = new fabric.Circle({
            radius: 40,
            fill: '#ffffff',
            stroke: '#e5e7eb',
            strokeWidth: 1,
            selectable: true,
            hasControls: true
          });
          return circle;
        }
      },
      {
        id: 'shape.triangle',
        name: 'Triangle',
        category: 'basic',
        description: 'Triangle shape',
        icon: '▲',
        builder: () => {
          const triangle = new fabric.Triangle({
            width: 80,
            height: 80,
            fill: '#ffffff',
            stroke: '#e5e7eb',
            strokeWidth: 1,
            selectable: true,
            hasControls: true
          });
          return triangle;
        }
      },
      {
        id: 'text.basic',
        name: 'Text',
        category: 'basic',
        description: 'Add text to design',
        icon: '📝',
        builder: () => {
          const text = new fabric.IText('Edit text', {
            fontSize: 16,
            fill: '#111827',
            selectable: true,
            hasControls: true,
            editable: true
          });
          return text;
        }
      },
      {
        id: 'line.basic',
        name: 'Line',
        category: 'basic',
        description: 'Straight line',
        icon: '➖',
        builder: () => {
          const line = new fabric.Line([0, 0, 100, 0], {
            stroke: '#e5e7eb',
            strokeWidth: 2,
            selectable: true,
            hasControls: true
          });
          return line;
        }
      }
    ],

    // 🔘 INTERACTIVE ELEMENTS
    'interactive': [
      {
        id: 'button.creator',
        name: 'Button Creator',
        category: 'interactive',
        description: 'Create custom buttons with CSS',
        icon: '🎨',
        builder: () => createCSSButton('Custom Button')
      },
      {
        id: 'button.filled',
        name: 'Filled Button',
        category: 'interactive',
        description: 'Solid colored button',
        icon: '🔘',
        builder: () => createFilledButton('Button')
      },
      {
        id: 'button.outline',
        name: 'Outline Button',
        category: 'interactive',
        description: 'Outlined button',
        icon: '🔘',
        builder: () => createOutlineButton('Button')
      },
      {
        id: 'button.icon',
        name: 'Icon Button',
        category: 'interactive',
        description: 'Button with icon',
        icon: '🔘',
        builder: () => createIconButton('⭐', 'Action')
      },
      {
        id: 'button.small',
        name: 'Small Button',
        category: 'interactive',
        description: 'Compact button',
        icon: '🔘',
        builder: () => createSmallButton('Small')
      },
      {
        id: 'button.applePrimary',
        name: 'Apple Primary',
        category: 'interactive',
        description: 'Premium iOS style button',
        icon: '🔘',
        builder: () => createApplePrimaryButton('Get Started')
      },
      {
        id: 'button.appleSecondary',
        name: 'Apple Secondary',
        category: 'interactive',
        description: 'Soft gray Apple button',
        icon: '🔘',
        builder: () => createAppleSecondaryButton('Learn More')
      },
      {
        id: 'input.text',
        name: 'Text Input',
        category: 'interactive',
        description: 'Input text field',
        icon: '📝',
        builder: () => createTextField('Enter text...')
      },
      {
        id: 'input.textarea',
        name: 'Text Area',
        category: 'interactive',
        description: 'Multi-line text input',
        icon: '📝',
        builder: () => createTextArea('Enter longer text...')
      },
      {
        id: 'input.search',
        name: 'Search Field',
        category: 'interactive',
        description: 'Search input with icon',
        icon: '🔍',
        builder: () => createSearchField('Search...')
      }
    ],

    // 🎨 STYLING TOOLS
    'styling': [
      {
        id: 'tool.gradient',
        name: 'Gradient Generator',
        category: 'styling',
        description: 'Create CSS gradients',
        icon: '🌈',
        builder: () => createGradientTool()
      },
      {
        id: 'tool.shadow',
        name: 'Shadow Generator',
        category: 'styling',
        description: 'Add shadows to elements',
        icon: '🌑',
        builder: () => createShadowTool()
      },
      {
        id: 'tool.typography',
        name: 'Typography Kit',
        category: 'styling',
        description: 'Advanced text styling',
        icon: '🔤',
        builder: () => createTypographyTool()
      },
      {
        id: 'tool.border',
        name: 'Border Styler',
        category: 'styling',
        description: 'Custom borders and radius',
        icon: '🔲',
        builder: () => createBorderTool()
      }
    ],

    // 📦 LAYOUT ELEMENTS
    'layout': [
      {
        id: 'layout.container',
        name: 'Container',
        category: 'layout',
        description: 'Layout container',
        icon: '📦',
        builder: () => createContainer(300, 200)
      },
      {
        id: 'layout.flex',
        name: 'Flexbox',
        category: 'layout',
        description: 'Flexbox layout',
        icon: '📐',
        builder: () => createFlexboxContainer()
      },
      {
        id: 'layout.grid',
        name: 'Grid',
        category: 'layout',
        description: 'CSS Grid layout',
        icon: '🔳',
        builder: () => createGridContainer()
      },
      {
        id: 'layout.divider',
        name: 'Divider',
        category: 'layout',
        description: 'Horizontal divider',
        icon: '➖',
        builder: () => createDivider(300)
      }
    ],

    // 📱 UI COMPONENTS
    'ui': [
      {
        id: 'card.simple',
        name: 'Card',
        category: 'ui',
        description: 'Simple card component',
        icon: '🃏',
        builder: () => createCard('Card Title', 'Card content')
      },
      {
        id: 'card.product',
        name: 'Product Card',
        category: 'ui',
        description: 'Product card with image',
        icon: '🛍️',
        builder: () => createCardWithImage('Product', '$29.99')
      },
      {
        id: 'nav.basic',
        name: 'Navbar',
        category: 'ui',
        description: 'Navigation bar',
        icon: '🧭',
        builder: () => createNavbar('Brand')
      },
      {
        id: 'header.hero',
        name: 'Hero Header',
        category: 'ui',
        description: 'Hero section header',
        icon: '📄',
        builder: () => createHeroHeader('Welcome', 'Subtitle')
      },
      {
        id: 'icon.basic',
        name: 'Icon',
        category: 'ui',
        description: 'Circular icon with label',
        icon: '⭐',
        builder: () => createIcon('⭐', 'Star')
      }
    ],

    // 📄 TEMPLATES
    'templates': [
      {
        id: 'template.landing',
        name: 'Landing Page',
        category: 'templates',
        description: 'Full landing page template',
        icon: '🚀',
        builder: () => buildLandingTemplate()
      },
      {
        id: 'template.login',
        name: 'Login Page',
        category: 'templates',
        description: 'Login/authentication page',
        icon: '🔐',
        builder: () => buildLoginTemplate()
      },
      {
        id: 'template.product',
        name: 'Product Page',
        category: 'templates',
        description: 'E-commerce product page',
        icon: '🛒',
        builder: () => buildProductPageTemplate()
      },
      {
        id: 'template.dashboard',
        name: 'Dashboard',
        category: 'templates',
        description: 'Admin dashboard layout',
        icon: '📊',
        builder: () => buildDashboardTemplate()
      }
    ]
  };

  // ==================== UPDATED PANEL RENDERER ====================

  function renderComponentPanel(containerEl) {
    if (!containerEl) return;
    
    containerEl.innerHTML = '';
    
    const panelHTML = `
      <div class="panel-header">
        <h3>📦 Design Components</h3>
        <button id="togglePanel" class="panel-toggle">⮞</button>
      </div>
      <div class="panel-search">
        <input type="text" id="componentSearch" placeholder="Search components..." />
      </div>
      <div class="panel-categories">
        <button class="category-btn active" data-category="all">All</button>
        <button class="category-btn" data-category="basic">📝 Basic</button>
        <button class="category-btn" data-category="interactive">🔘 Interactive</button>
        <button class="category-btn" data-category="styling">🎨 Styling</button>
        <button class="category-btn" data-category="layout">📦 Layout</button>
        <button class="category-btn" data-category="ui">📱 UI</button>
        <button class="category-btn" data-category="templates">📄 Templates</button>
      </div>
      <div class="components-grid" id="componentsGrid"></div>
    `;
    
    containerEl.innerHTML = panelHTML;
    
    // Render components by category
    function renderComponents(category = 'all') {
      const grid = document.getElementById('componentsGrid');
      if (!grid) return;
      
      grid.innerHTML = '';
      
      if (category === 'all') {
        // Render all categories with headers
        Object.keys(organizedComponents).forEach(cat => {
          const categoryComponents = organizedComponents[cat];
          if (categoryComponents.length === 0) return;
          
          // Add category header
          const header = document.createElement('div');
          header.className = 'category-header';
          header.innerHTML = `
            <h4>${getCategoryTitle(cat)}</h4>
          `;
          grid.appendChild(header);
          
          // Add components for this category
          categoryComponents.forEach(comp => {
            grid.appendChild(createComponentCard(comp));
          });
        });
      } else {
        // Render specific category
        const categoryComponents = organizedComponents[category] || [];
        categoryComponents.forEach(comp => {
          grid.appendChild(createComponentCard(comp));
        });
      }
      
      if (grid.children.length === 0) {
        grid.innerHTML = `<div style="text-align: center; padding: 40px; color: #666;">
          No components found
        </div>`;
      }
    }
    
    function createComponentCard(comp) {
      const card = document.createElement('div');
      card.className = 'component-card';
      card.innerHTML = `
        <div class="component-preview">${comp.icon || getIcon(comp.category)}</div>
        <div class="component-name">${comp.name}</div>
        <div class="component-desc">${comp.description}</div>
        <div class="component-category">${comp.category}</div>
      `;
      
      card.addEventListener('click', () => {
        try {
          const component = comp.builder();
          
          if (global.canvas) {
            // Center on canvas
            const centerX = global.canvas.width / 2;
            const centerY = global.canvas.height / 2;
            
            component.set({
              left: centerX - (component.width || 100) / 2,
              top: centerY - (component.height || 50) / 2
            });
            
            global.canvas.add(component);
            global.canvas.setActiveObject(component);
            
            // Apply main script's resizable behavior
            if (typeof makeObjectResizable === 'function') {
              makeObjectResizable(component);
            }
            
            global.canvas.requestRenderAll();
          }
        } catch (error) {
          console.error('Error adding component:', error);
        }
      });
      
      return card;
    }
    
    function getCategoryTitle(category) {
      const titles = {
        'basic': '📝 Basic Elements',
        'interactive': '🔘 Interactive Elements',
        'styling': '🎨 Styling Tools',
        'layout': '📦 Layout Elements',
        'ui': '📱 UI Components',
        'templates': '📄 Templates',
        'animations': '🔄 Animations'
      };
      return titles[category] || category;
    }
    
    // function getIcon(category) {
    //   const icons = {
    //     'basic': '📝',
    //     'interactive': '🔘',
    //     'styling': '🎨',
    //     'layout': '📦',
    //     'ui': '📱',
    //     'templates': '📄',
    //     'animations': '🔄'
    //   };
    //   return icons[category] || '🔹';
    // }
    
    // Initialize
    renderComponents('all');
    
    // Category buttons
    document.querySelectorAll('.category-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.category-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        renderComponents(btn.dataset.category);
      });
    });
    
    // Search
    document.getElementById('componentSearch').addEventListener('input', (e) => {
      const term = e.target.value.toLowerCase();
      const activeCat = document.querySelector('.category-btn.active').dataset.category;
      
      // Filter all components
      let filtered = [];
      if (activeCat === 'all') {
        Object.values(organizedComponents).forEach(cat => {
          filtered.push(...cat);
        });
      } else {
        filtered = organizedComponents[activeCat] || [];
      }
      
      if (term) {
        filtered = filtered.filter(c => 
          c.name.toLowerCase().includes(term) || 
          c.description.toLowerCase().includes(term) ||
          c.category.toLowerCase().includes(term)
        );
      }
      
      const grid = document.getElementById('componentsGrid');
      grid.innerHTML = '';
      
      if (filtered.length > 0) {
        if (activeCat === 'all') {
          // Group by category
          const grouped = {};
          filtered.forEach(comp => {
            if (!grouped[comp.category]) grouped[comp.category] = [];
            grouped[comp.category].push(comp);
          });
          
          Object.keys(grouped).forEach(cat => {
            const header = document.createElement('div');
            header.className = 'category-header';
            header.innerHTML = `<h4>${getCategoryTitle(cat)}</h4>`;
            grid.appendChild(header);
            
            grouped[cat].forEach(comp => {
              grid.appendChild(createComponentCard(comp));
            });
          });
        } else {
          filtered.forEach(comp => {
            grid.appendChild(createComponentCard(comp));
          });
        }
      } else {
        grid.innerHTML = `<div style="text-align: center; padding: 40px; color: #666;">
          No components found for "${term}"
        </div>`;
      }
    });
    
    // Toggle panel
    document.getElementById('togglePanel').addEventListener('click', () => {
      containerEl.classList.toggle('collapsed');
      const toggleBtn = document.getElementById('togglePanel');
      toggleBtn.textContent = containerEl.classList.contains('collapsed') ? '⮜' : '⮞';
      
      setTimeout(() => {
        if (typeof resizeCanvas === 'function') {
          resizeCanvas();
        }
      }, 300);
    });
  }

  // ==================== WIRE UP PANEL ====================
  function wireComponentPanel() {
    const panel = document.getElementById('componentPanel');
    const handle = document.getElementById('componentPanelHandle');
    
    if (!panel || !handle) return;
    
    handle.addEventListener('click', () => {
      panel.classList.toggle('collapsed');
      handle.textContent = panel.classList.contains('collapsed') ? '📦' : '⮞';
      
      setTimeout(() => {
        if (typeof resizeCanvas === 'function') {
          resizeCanvas();
        }
      }, 300);
    });
  }

  // ==================== REGISTER ALL COMPONENTS ====================

  // Register all components
  function registerAllComponents() {
    Object.values(organizedComponents).forEach(category => {
      category.forEach(comp => {
        ComponentRegistry.register(comp.id, comp.category, comp.name, comp.builder);
      });
    });
  }

  // Call registration
  registerAllComponents();

  // ------------------------------------------------------------------
  // Expose to global scope
  // ------------------------------------------------------------------
  global.ComponentRegistry = ComponentRegistry;
  global.renderComponentPanel = renderComponentPanel;
  global.wireComponentPanel = wireComponentPanel;

  // ------------------------------------------------------------------
  // Auto-initialize
  // ------------------------------------------------------------------
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeComponents);
  } else {
    initializeComponents();
  }

  function initializeComponents() {
    const panel = document.getElementById('componentPanel');
    if (panel) {
      renderComponentPanel(panel);
      wireComponentPanel();
    }
    
    // Ensure canvas resizes properly
    setTimeout(() => {
      if (typeof resizeCanvas === 'function') {
        resizeCanvas();
      }
    }, 100);
  }

})(window);