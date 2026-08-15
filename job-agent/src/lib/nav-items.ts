import {
  Briefcase,
  Home,
  MessageSquare,
  Target,
  User,
  type LucideIcon,
} from "lucide-react";

export interface NavItem {
  href: string;
  label: string;
  shortLabel: string;
  icon: LucideIcon;
}

export const navItems: NavItem[] = [
  { href: "/", label: "仪表盘", shortLabel: "首页", icon: Home },
  { href: "/experience", label: "我的经历", shortLabel: "经历", icon: User },
  { href: "/jobs", label: "岗位管理", shortLabel: "岗位", icon: Briefcase },
  { href: "/match", label: "智能匹配", shortLabel: "匹配", icon: Target },
  { href: "/agent", label: "职业顾问", shortLabel: "顾问", icon: MessageSquare },
];

export function getNavTitle(pathname: string): string {
  if (pathname === "/") return "仪表盘";
  if (pathname === "/offboard") return "离职清理";
  const item = navItems.find((n) => n.href === pathname);
  return item?.label ?? "JobAgent";
}
