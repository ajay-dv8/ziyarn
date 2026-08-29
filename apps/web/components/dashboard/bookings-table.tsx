"use client";

import { Button } from "@repo/ui/components/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@repo/ui/components/table";
import { Badge } from "@repo/ui/components/badge";

type Booking = {
  id: string;
  name: string | null;
  email: string | null;
  date: string;
  time: string;
  duration: number;
  timezone: string;
  topic: string | null;
  status: "pending" | "confirmed" | "cancelled";
  createdAt: string | Date;
};

const STATUS_STYLES: Record<string, string> = {
  pending: "bg-yellow-100 text-yellow-800 border-yellow-200",
  confirmed: "bg-green-100 text-green-800 border-green-200",
  cancelled: "bg-red-100 text-red-800 border-red-200",
};

export function BookingsTable({
  bookings,
  onUpdateStatus,
}: {
  bookings: Booking[];
  onUpdateStatus: (id: string, status: "confirmed" | "cancelled") => void;
}) {
  return (
    <div className="rounded-lg border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Visitor</TableHead>
            <TableHead>Date & Time</TableHead>
            <TableHead>Duration</TableHead>
            <TableHead>Topic</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {bookings.map((booking) => (
            <TableRow key={booking.id}>
              <TableCell>
                <div>
                  <p className="font-medium">{booking.name || "Anonymous"}</p>
                  {booking.email && (
                    <p className="text-xs text-muted-foreground">{booking.email}</p>
                  )}
                </div>
              </TableCell>
              <TableCell>
                <div>
                  <p className="font-medium">{booking.date}</p>
                  <p className="text-xs text-muted-foreground">{booking.time}</p>
                </div>
              </TableCell>
              <TableCell>{booking.duration}min</TableCell>
              <TableCell>
                <span className="truncate max-w-[200px] block">
                  {booking.topic || "—"}
                </span>
              </TableCell>
              <TableCell>
                <Badge variant="outline" className={STATUS_STYLES[booking.status]}>
                  {booking.status}
                </Badge>
              </TableCell>
              <TableCell className="text-right">
                {booking.status === "pending" && (
                  <div className="flex justify-end gap-1">
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 text-xs text-green-700 border-green-200 hover:bg-green-50"
                      onClick={() => onUpdateStatus(booking.id, "confirmed")}
                    >
                      Confirm
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 text-xs text-red-700 border-red-200 hover:bg-red-50"
                      onClick={() => onUpdateStatus(booking.id, "cancelled")}
                    >
                      Cancel
                    </Button>
                  </div>
                )}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
