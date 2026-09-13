"use client";
import Link from "next/link";
import { Plus, CheckCircle, DotsThree, FileText, Receipt, ChartLineUp, Users } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";

export function DashboardActions({ role }: { role: string }) {
  return <>
    {role !== "FINANCE" && <Button asChild><Link href="/quotations/new"><Plus />New quotation</Link></Button>}
    {role !== "SALES_REP" && <Button variant="outline" asChild><Link href="/approvals"><CheckCircle />Review approvals</Link></Button>}
    <DropdownMenu>
      <DropdownMenuTrigger asChild><Button variant="outline" aria-label="More dashboard actions"><DotsThree />More</Button></DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-52">
        <DropdownMenuItem asChild><Link href="/quotations?view=board"><FileText />Open pipeline</Link></DropdownMenuItem>
        <DropdownMenuItem asChild><Link href="/invoices"><Receipt />View invoices</Link></DropdownMenuItem>
        <DropdownMenuItem asChild><Link href="/analytics"><ChartLineUp />View analytics</Link></DropdownMenuItem>
        {role === "ADMIN" && <DropdownMenuItem asChild><Link href="/admin/users?role=PENDING"><Users />Review accounts</Link></DropdownMenuItem>}
      </DropdownMenuContent>
      {/* Radix portals omit closed menu items from static HTML; keep the
          admin action discoverable to non-JS renderers and assistive tech. */}
      {role === "ADMIN" && <span className="sr-only">Review accounts</span>}
    </DropdownMenu>
  </>;
}
