import { trpc } from "@/lib/trpc";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Bell, CheckCheck, Info, AlertTriangle, CheckCircle, XCircle } from "lucide-react";
import { PageTransition } from "@/components/PageTransition";
import { formatDistanceToNow } from "date-fns";
import { es } from "date-fns/locale";

const typeConfig: Record<string, { icon: any; color: string }> = {
  info: { icon: Info, color: "text-blue-500" },
  warning: { icon: AlertTriangle, color: "text-amber-500" },
  success: { icon: CheckCircle, color: "text-emerald-500" },
  error: { icon: XCircle, color: "text-red-500" },
};

export default function NotificationsPage() {
  const utils = trpc.useUtils();
  const { data: notifications, isLoading } = trpc.notifications.list.useQuery();

  const markReadMutation = trpc.notifications.markRead.useMutation({
    onMutate: async ({ id }) => {
      await utils.notifications.list.cancel();
      const prev = utils.notifications.list.getData();
      utils.notifications.list.setData(undefined, (old) =>
        old?.map(n => n.id === id ? { ...n, isRead: true } : n)
      );
      return { prev };
    },
    onError: (_err, _vars, context) => {
      if (context?.prev) utils.notifications.list.setData(undefined, context.prev);
    },
    onSettled: () => utils.notifications.list.invalidate(),
  });

  const markAllReadMutation = trpc.notifications.markAllRead.useMutation({
    onSuccess: () => utils.notifications.list.invalidate(),
  });

  const unreadCount = notifications?.filter(n => !n.isRead).length ?? 0;

  return (
    <PageTransition className="space-y-6 max-w-3xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Notificaciones</h1>
          <p className="text-muted-foreground mt-1">
            {unreadCount > 0 ? `${unreadCount} sin leer` : "Todas leídas"}
          </p>
        </div>
        {unreadCount > 0 && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => markAllReadMutation.mutate()}
            disabled={markAllReadMutation.isPending}
          >
            <CheckCheck className="h-4 w-4 mr-2" />
            Marcar todas como leídas
          </Button>
        )}
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map(i => <Skeleton key={i} className="h-20 w-full rounded-lg" />)}
        </div>
      ) : !notifications || notifications.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <Bell className="h-12 w-12 mx-auto mb-3 opacity-30" />
          <p className="text-lg font-medium">Sin notificaciones</p>
          <p className="text-sm mt-1">Las notificaciones aparecerán aquí</p>
        </div>
      ) : (
        <div className="space-y-2">
          {notifications.map(notification => {
            const config = typeConfig[notification.type] || typeConfig.info;
            const Icon = config.icon;
            return (
              <Card
                key={notification.id}
                className={`border-border/50 transition-all cursor-pointer hover:shadow-sm ${!notification.isRead ? "bg-primary/5 border-primary/20" : ""}`}
                onClick={() => {
                  if (!notification.isRead) markReadMutation.mutate({ id: notification.id });
                }}
              >
                <CardContent className="p-4">
                  <div className="flex items-start gap-3">
                    <Icon className={`h-5 w-5 mt-0.5 shrink-0 ${config.color}`} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-medium">{notification.title}</p>
                        {!notification.isRead && (
                          <Badge className="text-xs bg-primary/20 text-primary border-0">Nuevo</Badge>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground mt-0.5">{notification.message}</p>
                      <p className="text-xs text-muted-foreground mt-1.5">
                        {formatDistanceToNow(new Date(notification.createdAt), { addSuffix: true, locale: es })}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </PageTransition>
  );
}
