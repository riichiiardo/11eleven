import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
// simple logo dropdown component that can be used to go to the landing page or sign out for the user
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger, } from "@/components/ui/dropdown-menu";
import logo from "@/assets/logo.svg";
import { useAuth } from "@/hooks/use-auth";
import { Home, LogOut } from "lucide-react";
import { useNavigate } from "react-router";
export function LogoDropdown() {
    const { isAuthenticated, signOut } = useAuth();
    const navigate = useNavigate();
    const handleSignOut = async () => {
        try {
            await signOut();
            navigate("/");
        }
        catch (error) {
            console.error("Sign out error:", error);
        }
    };
    const handleGoHome = () => {
        navigate("/");
    };
    return (_jsxs(DropdownMenu, { children: [_jsx(DropdownMenuTrigger, { asChild: true, children: _jsx(Button, { variant: "ghost", size: "icon", className: "h-10 w-10", children: _jsx("img", { src: logo, alt: "Logo", width: 32, height: 32, className: "rounded-lg" }) }) }), _jsxs(DropdownMenuContent, { align: "start", className: "w-48", children: [_jsxs(DropdownMenuItem, { onClick: handleGoHome, className: "cursor-pointer", children: [_jsx(Home, { className: "mr-2 h-4 w-4" }), "Landing Page"] }), isAuthenticated && (_jsxs(_Fragment, { children: [_jsx(DropdownMenuSeparator, {}), _jsxs(DropdownMenuItem, { onClick: handleSignOut, className: "cursor-pointer text-destructive focus:text-destructive", children: [_jsx(LogOut, { className: "mr-2 h-4 w-4" }), "Sign Out"] })] }))] })] }));
}
