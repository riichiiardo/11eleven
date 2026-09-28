import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
// DO NOT MODIFY THIS FILE. THIS FILE IS READ-ONLY. CONTAINS ALL KEY APP FUNCTIONALITY.
import React, { useState, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { MousePointer, ExternalLink, AlertTriangle } from "lucide-react";
import { snapdom } from "@zumer/snapdom";
const FunctionComponent = 0;
const ClassComponent = 1;
const HostComponent = 5;
export function getReactComponentHierarchy(element) {
    if (!element) {
        return null;
    }
    const components = [];
    const maxComponents = 3;
    // Find the internal React Fiber node key.
    const fiberKey = Object.keys(element).find((key) => key.startsWith("__reactFiber$") ||
        key.startsWith("__reactInternalInstance$"));
    if (!fiberKey) {
        return null;
    }
    let currentFiber = element[fiberKey];
    if (!currentFiber) {
        return null;
    }
    // Traverse up the Fiber tree.
    while (currentFiber && components.length < maxComponents) {
        let componentData = null;
        if (currentFiber.tag === ClassComponent ||
            currentFiber.tag === FunctionComponent) {
            const componentDefinition = currentFiber.type;
            if (componentDefinition) {
                const def = componentDefinition;
                const name = def.displayName ||
                    def.name ||
                    currentFiber._debugOwner?.name ||
                    "AnonymousComponent";
                componentData = { name, type: "regular" };
            }
        }
        else if (currentFiber.tag === HostComponent &&
            currentFiber._debugOwner &&
            currentFiber._debugOwner.env?.toLowerCase().includes("server")) {
            componentData = { name: currentFiber._debugOwner.name, type: "rsc" };
        }
        if (componentData) {
            const alreadyExists = components.some((c) => c.name === componentData.name && c.type === componentData.type);
            if (!alreadyExists) {
                components.push(componentData);
            }
        }
        currentFiber = currentFiber.return;
    }
    return components.length > 0 ? components : null;
}
export function formatReactComponentHierarchy(hierarchy) {
    if (!hierarchy || hierarchy.length === 0) {
        return "No React components found for this element.";
    }
    const parts = hierarchy.map((info) => `{name: ${info.name}, type: ${info.type}}`);
    let description = `React component tree (from closest to farthest, ${hierarchy.length} closest element${hierarchy.length > 1 ? "s" : ""}): `;
    description += parts.join(" child of ");
    return description;
}
export function getSelectedElementAnnotation(element) {
    const hierarchy = getReactComponentHierarchy(element);
    if (hierarchy?.[0]) {
        return {
            annotation: `${hierarchy[0].name}${hierarchy[0].type === "rsc" ? " (RSC)" : ""}`,
        };
    }
    return { annotation: null };
}
export function getSelectedElementsPrompt(elements) {
    const selectedComponentHierarchies = elements.map((e) => getReactComponentHierarchy(e));
    if (selectedComponentHierarchies.some((h) => h && h.length > 0)) {
        const content = `This is additional information on the elements that the user selected. Use this information to find the correct element in the codebase.

  ${selectedComponentHierarchies.map((h, index) => {
            return `
<element index="${index + 1}">
  ${!h || h.length === 0 ? "No React component as parent detected" : `React component tree (from closest to farthest, 3 closest elements): ${h.map((c) => `{name: ${c.name}, type: ${c.type}}`).join(" child of ")}`}
</element>
    `;
        })}
  `;
        return content;
    }
    return null;
}
const HIGHLIGHT_CLASS = "vly-toolbar-highlight";
// Add highlight style to the document
const injectHighlightStyle = () => {
    if (document.getElementById("vly-toolbar-style"))
        return;
    const style = document.createElement("style");
    style.id = "vly-toolbar-style";
    style.innerHTML = `
    .${HIGHLIGHT_CLASS} {
      outline: 2px solid #0070f3;
      cursor: pointer;
      background: rgba(0,112,243,0.08);
    }
  `;
    document.head.appendChild(style);
};
function getDomSelector(el) {
    if (el.id)
        return `#${el.id}`;
    if (el.className && typeof el.className === "string") {
        return (el.tagName.toLowerCase() + "." + el.className.trim().replace(/\s+/g, "."));
    }
    return el.tagName.toLowerCase();
}
const Overlay = ({ toolbarRef, onSelect, onHover, onUnhover, selectMode }) => {
    const lastHovered = useRef(null);
    const handleMouseMove = useCallback((e) => {
        if (!selectMode)
            return;
        const overlay = e.currentTarget;
        overlay.style.pointerEvents = "none";
        const el = document.elementFromPoint(e.clientX, e.clientY);
        overlay.style.pointerEvents = "auto";
        // Build ignore list from toolbar ref
        const shouldIgnore = el && toolbarRef.current && (el === toolbarRef.current || toolbarRef.current.contains(el));
        if (!el || shouldIgnore)
            return;
        if (lastHovered.current !== el) {
            if (lastHovered.current)
                lastHovered.current.classList.remove(HIGHLIGHT_CLASS);
            lastHovered.current = el;
            el.classList.add(HIGHLIGHT_CLASS);
            onHover(el);
        }
    }, [toolbarRef, onHover, selectMode]);
    const handleMouseLeave = useCallback(() => {
        if (!selectMode)
            return;
        if (lastHovered.current) {
            lastHovered.current.classList.remove(HIGHLIGHT_CLASS);
            lastHovered.current = null;
        }
        onUnhover();
    }, [onUnhover, selectMode]);
    const handleClick = useCallback((e) => {
        e.preventDefault();
        e.stopPropagation();
        const overlay = e.currentTarget;
        overlay.style.pointerEvents = "none";
        const el = document.elementFromPoint(e.clientX, e.clientY);
        overlay.style.pointerEvents = "auto";
        // Build ignore list from toolbar ref
        const shouldIgnore = el && toolbarRef.current && (el === toolbarRef.current || toolbarRef.current.contains(el));
        if (!el || shouldIgnore)
            return;
        if (lastHovered.current)
            lastHovered.current.classList.remove(HIGHLIGHT_CLASS);
        onSelect(el);
    }, [toolbarRef, onSelect]);
    return (_jsx("div", { style: {
            position: "fixed",
            inset: 0,
            zIndex: 9998,
            cursor: "copy",
            pointerEvents: "auto",
        }, onMouseMove: handleMouseMove, onMouseLeave: handleMouseLeave, onClick: handleClick, tabIndex: 0, role: "button" }));
};
export const VlyToolbar = () => {
    const [selectMode, setSelectMode] = useState(false);
    const toolbarRef = useRef(null);
    const [showDevOverlay, setShowDevOverlay] = React.useState(true);
    const isDevDeployment = typeof window !== "undefined" &&
        window.location.hostname.endsWith(".vly.sh") &&
        window.self === window.top;
    React.useEffect(() => {
        injectHighlightStyle();
    }, []);
    // Listen for postMessage from parent to enable/disable select mode
    React.useEffect(() => {
        function handleMessage(event) {
            if (event.data && event.data.type === "vly-toolbar-enable-select") {
                setSelectMode(true);
            }
            if (event.data && event.data.type === "vly-toolbar-disable-select") {
                setSelectMode(false);
            }
        }
        window.addEventListener("message", handleMessage);
        return () => window.removeEventListener("message", handleMessage);
    }, []);
    // Callbacks for overlay
    const handleSelect = useCallback(async (el) => {
        setSelectMode(false);
        const selector = getDomSelector(el);
        const hierarchy = getReactComponentHierarchy(el);
        const formatted = formatReactComponentHierarchy(hierarchy);
        let imageDataUrl = undefined;
        try {
            // Optionally, preload resources for best results
            // await preCache(el);
            const canvas = await snapdom.toCanvas(el, { fast: true });
            imageDataUrl = canvas.toDataURL("image/png");
        }
        catch (e) {
            console.error("Failed to snapshot element", e);
        }
        window.parent.postMessage({
            type: "vly-toolbar-select",
            selector,
            reactHierarchy: hierarchy,
            reactHierarchyFormatted: formatted,
            image: imageDataUrl,
        }, "*");
    }, []);
    const handleHover = useCallback(() => {
        // Optionally do something on hover
    }, []);
    const handleUnhover = useCallback(() => {
        // Optionally do something on unhover
    }, []);
    // Get project name for redirect URL
    const getProjectName = () => {
        if (typeof window !== "undefined") {
            const hostname = window.location.hostname;
            // Extract project name from hostname (e.g., "projectname.vly.sh")
            const match = hostname.match(/^([^.]+)\.vly\.sh$/);
            return match ? match[1] : "unknown";
        }
        return "unknown";
    };
    // Handle escape key to close modal
    React.useEffect(() => {
        const handleKeyDown = (e) => {
            if (e.key === 'Escape' && showDevOverlay) {
                setShowDevOverlay(false);
            }
        };
        if (showDevOverlay) {
            document.addEventListener('keydown', handleKeyDown);
            return () => document.removeEventListener('keydown', handleKeyDown);
        }
    }, [showDevOverlay]);
    const handleOverlayClick = (e) => {
        // Only dismiss if clicking the overlay itself, not the modal content
        if (e.target === e.currentTarget) {
            setShowDevOverlay(false);
        }
    };
    const handleContinue = () => {
        setShowDevOverlay(false);
    };
    const handleGoToProject = () => {
        const projectName = getProjectName();
        window.location.href = `https://freebuff.com/project/${projectName}?publish=true`;
    };
    return (_jsxs(_Fragment, { children: [isDevDeployment && showDevOverlay && (_jsx("div", { onClick: handleOverlayClick, role: "dialog", "aria-modal": "true", "aria-labelledby": "dev-env-label", style: {
                    position: "fixed",
                    inset: 0,
                    zIndex: 99999,
                    backdropFilter: "blur(8px)",
                    WebkitBackdropFilter: "blur(8px)",
                    backgroundColor: "rgba(0, 0, 0, 0.1)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    cursor: "pointer",
                }, children: _jsx(AnimatePresence, { children: _jsx(motion.div, { onClick: (e) => e.stopPropagation(), initial: { opacity: 0, scale: 0.9 }, animate: { opacity: 1, scale: 1 }, exit: { opacity: 0, scale: 0.9 }, transition: { duration: 0.3, ease: "easeInOut" }, style: {
                            position: "relative",
                            cursor: "default",
                        }, children: _jsxs("div", { className: "flex items-center gap-3 rounded-lg border border-white/30 bg-white/95 px-4 py-3 shadow-lg", children: [_jsx("div", { className: "flex items-center gap-2 rounded px-2 py-1 transition-colors hover:bg-white/95", children: _jsxs("div", { className: "flex items-center gap-2", children: [_jsx(AlertTriangle, { className: "h-4 w-4 text-orange-500" }), _jsx("span", { id: "dev-env-label", className: "text-sm font-medium text-gray-700", title: "Development deployment - should not be shared publicly. Use 'Go to project' to create a production version.", children: "This is a testing environment. Share only your published project." })] }) }), _jsx("div", { className: "h-6 w-px bg-gray-300" }), _jsxs("button", { onClick: handleContinue, className: "flex items-center gap-2 rounded px-2 py-1 transition-colors hover:bg-white/95", children: [_jsx(MousePointer, { className: "h-4 w-4 text-gray-600" }), _jsx("span", { className: "text-sm font-medium text-gray-700", children: "Click to test" })] }), _jsx("div", { className: "h-6 w-px bg-gray-300" }), _jsxs("button", { onClick: (e) => {
                                        e.stopPropagation();
                                        handleGoToProject();
                                    }, className: "flex items-center gap-2 rounded px-2 py-1 transition-colors hover:bg-white/95", children: [_jsx(ExternalLink, { className: "h-4 w-4 text-gray-600" }), _jsx("span", { className: "text-sm font-medium text-gray-700", children: "Publish Project" })] })] }) }) }) })), selectMode && (_jsx(Overlay, { toolbarRef: toolbarRef, onSelect: handleSelect, onHover: handleHover, onUnhover: handleUnhover, selectMode: selectMode }))] }));
};
export default VlyToolbar;
