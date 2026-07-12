import { useState, useEffect } from 'react';
import { useLocation } from 'wouter';
import { useAppContext } from '@/context/AppContext';
import { getBlogPostsForStore, deleteBlogPost, BlogPost } from '@/lib/db';
import { motion } from 'framer-motion';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { Plus, Trash2, Pencil, Loader2, Newspaper, ExternalLink, CheckCircle2, FileEdit } from 'lucide-react';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';

export default function Blog() {
  const { language, currentStore, isAdminMode } = useAppContext();
  const isAr = language === 'ar';
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const [posts, setPosts] = useState<BlogPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleteTarget, setDeleteTarget] = useState<BlogPost | null>(null);
  const [deleting, setDeleting] = useState(false);

  const load = async () => {
    if (!currentStore) return;
    setLoading(true);
    const rows = await getBlogPostsForStore(currentStore.id, isAdminMode);
    setPosts(rows);
    setLoading(false);
  };

  useEffect(() => { load(); }, [currentStore?.id]);

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    const ok = await deleteBlogPost(deleteTarget.id, isAdminMode);
    setDeleting(false);
    setDeleteTarget(null);
    if (ok) {
      toast({ title: isAr ? 'تم حذف المقال' : 'Post deleted' });
      load();
    } else {
      toast({ title: isAr ? 'تعذّر الحذف' : 'Could not delete', variant: 'destructive' });
    }
  };

  const storeUrl = currentStore?.domain
    ? `https://${currentStore.domain}`
    : currentStore?.slug
    ? `https://${currentStore.slug}.mawq3i.co`
    : '';

  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25 }} className="p-6 max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Newspaper className="w-6 h-6 text-primary" />
            {isAr ? 'المدونة' : 'Blog'}
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            {isAr ? 'اكتب مقالات تجيب زوار جدد من قوقل مجاناً' : 'Write articles that bring new visitors from Google, for free'}
          </p>
        </div>
        <Button onClick={() => setLocation('/dashboard/blog/new')} className="gap-2">
          <Plus className="w-4 h-4" />
          {isAr ? 'مقال جديد' : 'New Post'}
        </Button>
      </div>

      {loading ? (
        <div className="flex justify-center py-16"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
      ) : posts.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="py-16 text-center space-y-3">
            <Newspaper className="w-10 h-10 mx-auto text-muted-foreground/40" />
            <p className="text-muted-foreground">{isAr ? 'ما في مقالات بعد — ابدأ بأول مقال لمتجرك' : 'No posts yet — write your first article'}</p>
            <Button onClick={() => setLocation('/dashboard/blog/new')} variant="outline" className="gap-2">
              <Plus className="w-4 h-4" />
              {isAr ? 'مقال جديد' : 'New Post'}
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {posts.map(post => (
            <Card key={post.id} className="border-border/50">
              <CardContent className="p-4 flex items-center gap-4">
                {post.coverImageUrl ? (
                  <img src={post.coverImageUrl} alt="" className="w-16 h-16 rounded-lg object-cover flex-shrink-0 bg-muted" />
                ) : (
                  <div className="w-16 h-16 rounded-lg bg-muted flex items-center justify-center flex-shrink-0">
                    <Newspaper className="w-6 h-6 text-muted-foreground/40" />
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <p className="font-medium truncate">{post.title}</p>
                  <div className="flex items-center gap-2 mt-1">
                    {post.status === 'published' ? (
                      <span className="flex items-center gap-1 text-[11px] text-emerald-500 bg-emerald-500/10 border border-emerald-500/20 rounded-full px-2 py-0.5">
                        <CheckCircle2 className="w-3 h-3" />{isAr ? 'منشور' : 'Published'}
                      </span>
                    ) : (
                      <span className="flex items-center gap-1 text-[11px] text-muted-foreground bg-muted border border-border/50 rounded-full px-2 py-0.5">
                        <FileEdit className="w-3 h-3" />{isAr ? 'مسودة' : 'Draft'}
                      </span>
                    )}
                    <span className="text-xs text-muted-foreground" dir="ltr">/{post.slug}</span>
                  </div>
                </div>
                <div className="flex items-center gap-1 flex-shrink-0">
                  {post.status === 'published' && storeUrl && (
                    <Button variant="outline" size="icon" className="h-8 w-8" asChild>
                      <a href={`${storeUrl}/blog-post?slug=${encodeURIComponent(post.slug)}`} target="_blank" rel="noopener noreferrer">
                        <ExternalLink className="w-3.5 h-3.5" />
                      </a>
                    </Button>
                  )}
                  <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => setLocation(`/dashboard/blog/edit/${post.id}`)}>
                    <Pencil className="w-3.5 h-3.5" />
                  </Button>
                  <Button variant="outline" size="icon" className="h-8 w-8 hover:border-red-500/50 hover:text-red-400" onClick={() => setDeleteTarget(post)}>
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{isAr ? 'حذف المقال؟' : 'Delete post?'}</AlertDialogTitle>
            <AlertDialogDescription>
              {isAr ? `سيتم حذف "${deleteTarget?.title}" نهائياً.` : `"${deleteTarget?.title}" will be permanently deleted.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{isAr ? 'إلغاء' : 'Cancel'}</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} disabled={deleting} className="bg-red-600 hover:bg-red-700">
              {deleting ? <Loader2 className="w-4 h-4 animate-spin" /> : (isAr ? 'حذف' : 'Delete')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </motion.div>
  );
}
