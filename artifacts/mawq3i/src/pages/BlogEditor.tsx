import { useState, useEffect, useRef } from 'react';
import { useLocation, useParams } from 'wouter';
import { useAppContext } from '@/context/AppContext';
import { getBlogPost, createBlogPost, updateBlogPost, slugify } from '@/lib/db';
import { uploadBlogCoverImage } from '@/lib/storage';
import { motion } from 'framer-motion';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { ArrowRight, Loader2, ImagePlus, X, Eye, Code2, Search } from 'lucide-react';

// Minimal, dependency-free markdown → HTML for the live preview.
// Mirrors (roughly) the renderer used server-side on the storefront.
function renderMarkdown(md: string): string {
  const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const lines = esc(md || '').split('\n');
  const html: string[] = [];
  let inList = false;
  for (let raw of lines) {
    const line = raw.trim();
    if (/^###\s+/.test(line)) { if (inList) { html.push('</ul>'); inList = false; } html.push(`<h3>${line.replace(/^###\s+/, '')}</h3>`); continue; }
    if (/^##\s+/.test(line)) { if (inList) { html.push('</ul>'); inList = false; } html.push(`<h2>${line.replace(/^##\s+/, '')}</h2>`); continue; }
    if (/^#\s+/.test(line)) { if (inList) { html.push('</ul>'); inList = false; } html.push(`<h1>${line.replace(/^#\s+/, '')}</h1>`); continue; }
    if (/^-\s+/.test(line)) {
      if (!inList) { html.push('<ul>'); inList = true; }
      html.push(`<li>${inline(line.replace(/^-\s+/, ''))}</li>`);
      continue;
    }
    if (inList) { html.push('</ul>'); inList = false; }
    if (!line) { continue; }
    html.push(`<p>${inline(line)}</p>`);
  }
  if (inList) html.push('</ul>');
  return html.join('\n');

  function inline(s: string): string {
    return s
      .replace(/!\[([^\]]*)\]\(([^)]+)\)/g, '<img src="$2" alt="$1">')
      .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>')
      .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
      .replace(/\*([^*]+)\*/g, '<em>$1</em>');
  }
}

export default function BlogEditor() {
  const { language, currentStore, isAdminMode } = useAppContext();
  const isAr = language === 'ar';
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const params = useParams<{ id?: string }>();
  const isEdit = !!params.id;

  const [loading, setLoading] = useState(isEdit);
  const [saving, setSaving] = useState(false);
  const [title, setTitle] = useState('');
  const [slug, setSlug] = useState('');
  const [slugTouched, setSlugTouched] = useState(false);
  const [excerpt, setExcerpt] = useState('');
  const [content, setContent] = useState('');
  const [coverImageUrl, setCoverImageUrl] = useState('');
  const [uploadingCover, setUploadingCover] = useState(false);
  const [metaTitle, setMetaTitle] = useState('');
  const [metaDescription, setMetaDescription] = useState('');
  const [status, setStatus] = useState<'draft' | 'published'>('draft');
  const [wasPublished, setWasPublished] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!isEdit || !params.id) return;
    (async () => {
      const post = await getBlogPost(params.id!, isAdminMode);
      if (post) {
        setTitle(post.title);
        setSlug(post.slug);
        setSlugTouched(true);
        setExcerpt(post.excerpt);
        setContent(post.content);
        setCoverImageUrl(post.coverImageUrl);
        setMetaTitle(post.metaTitle);
        setMetaDescription(post.metaDescription);
        setStatus(post.status);
        setWasPublished(post.status === 'published');
      }
      setLoading(false);
    })();
  }, [params.id]);

  const handleTitleChange = (v: string) => {
    setTitle(v);
    if (!slugTouched) setSlug(slugify(v));
  };

  const handleCoverUpload = async (file: File | null) => {
    if (!file || !currentStore) return;
    setUploadingCover(true);
    const url = await uploadBlogCoverImage(file, currentStore.id);
    setUploadingCover(false);
    if (url) setCoverImageUrl(url);
    else toast({ title: isAr ? 'تعذّر رفع الصورة' : 'Could not upload image', variant: 'destructive' });
  };

  const handleSave = async (publish?: boolean) => {
    if (!currentStore || !title.trim() || !content.trim()) {
      toast({ title: isAr ? 'العنوان والمحتوى مطلوبان' : 'Title and content are required', variant: 'destructive' });
      return;
    }
    setSaving(true);
    const finalStatus: 'draft' | 'published' = publish !== undefined ? (publish ? 'published' : 'draft') : status;
    const finalSlug = slug.trim() || slugify(title);

    if (isEdit && params.id) {
      const ok = await updateBlogPost(params.id, {
        title, slug: finalSlug, excerpt, content, coverImageUrl,
        metaTitle, metaDescription, status: finalStatus, wasPublished,
      }, isAdminMode);
      setSaving(false);
      if (ok) {
        toast({ title: isAr ? 'تم الحفظ' : 'Saved' });
        setLocation('/dashboard/blog');
      } else {
        toast({ title: isAr ? 'تعذّر الحفظ' : 'Could not save', variant: 'destructive' });
      }
    } else {
      const created = await createBlogPost(currentStore.id, {
        title, slug: finalSlug, excerpt, content, coverImageUrl,
        metaTitle, metaDescription, status: finalStatus, authorName: '',
      }, isAdminMode);
      setSaving(false);
      if (created) {
        toast({ title: isAr ? 'تم إنشاء المقال' : 'Post created' });
        setLocation('/dashboard/blog');
      } else {
        toast({ title: isAr ? 'تعذّر الإنشاء — تأكد إن الرابط (slug) غير مستخدم' : 'Could not create — check the slug isn\'t already used', variant: 'destructive' });
      }
    }
  };

  if (loading) {
    return <div className="flex justify-center py-24"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>;
  }

  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25 }} className="p-6 max-w-3xl mx-auto space-y-5 pb-24">
      <button onClick={() => setLocation('/dashboard/blog')} className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors">
        <ArrowRight className="w-4 h-4 rtl:rotate-180" />
        {isAr ? 'رجوع للمدونة' : 'Back to Blog'}
      </button>

      <Card>
        <CardContent className="p-5 space-y-4">
          <div className="space-y-1.5">
            <Label>{isAr ? 'العنوان' : 'Title'}</Label>
            <Input value={title} onChange={e => handleTitleChange(e.target.value)} placeholder={isAr ? 'مثال: أفضل 5 هوديز لشتاء 2026' : 'e.g. Best 5 hoodies for winter'} />
          </div>

          <div className="space-y-1.5">
            <Label>{isAr ? 'الرابط (slug)' : 'Slug'}</Label>
            <Input dir="ltr" value={slug} onChange={e => { setSlug(slugify(e.target.value)); setSlugTouched(true); }} placeholder="best-hoodies-winter-2026" />
          </div>

          <div className="space-y-1.5">
            <Label>{isAr ? 'مقتطف قصير (يظهر بقائمة المدونة)' : 'Short excerpt (shown in blog list)'}</Label>
            <Textarea value={excerpt} onChange={e => setExcerpt(e.target.value)} rows={2} placeholder={isAr ? 'جملة أو جملتين تلخص المقال...' : 'One or two sentences summarizing the post...'} />
          </div>

          <div className="space-y-1.5">
            <Label>{isAr ? 'صورة الغلاف' : 'Cover image'}</Label>
            {coverImageUrl ? (
              <div className="relative w-full max-w-xs">
                <img src={coverImageUrl} alt="" className="w-full aspect-video object-cover rounded-lg border border-border/50" />
                <button onClick={() => setCoverImageUrl('')} className="absolute top-2 end-2 bg-black/60 text-white rounded-full p-1 hover:bg-black/80">
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            ) : (
              <button
                onClick={() => fileRef.current?.click()}
                disabled={uploadingCover}
                className="w-full max-w-xs aspect-video rounded-lg border border-dashed border-border/60 flex flex-col items-center justify-center gap-2 text-muted-foreground hover:border-primary/50 hover:text-primary transition-colors"
              >
                {uploadingCover ? <Loader2 className="w-5 h-5 animate-spin" /> : <ImagePlus className="w-5 h-5" />}
                <span className="text-xs">{isAr ? 'رفع صورة' : 'Upload image'}</span>
              </button>
            )}
            <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={e => handleCoverUpload(e.target.files?.[0] ?? null)} />
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label>{isAr ? 'المحتوى' : 'Content'}</Label>
              <button
                type="button"
                onClick={() => setShowPreview(v => !v)}
                className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                {showPreview ? <Code2 className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                {showPreview ? (isAr ? 'تحرير' : 'Edit') : (isAr ? 'معاينة' : 'Preview')}
              </button>
            </div>
            {showPreview ? (
              <div
                className="prose prose-sm dark:prose-invert max-w-none border border-border/50 rounded-lg p-4 min-h-[240px] bg-background/50 [&_h1]:text-xl [&_h2]:text-lg [&_h3]:text-base [&_h1]:font-bold [&_h2]:font-bold [&_h3]:font-semibold [&_p]:my-2 [&_ul]:list-disc [&_ul]:ps-5 [&_a]:text-primary [&_img]:rounded-lg [&_img]:my-2"
                dangerouslySetInnerHTML={{ __html: renderMarkdown(content) }}
              />
            ) : (
              <Textarea
                value={content}
                onChange={e => setContent(e.target.value)}
                rows={14}
                dir="auto"
                className="font-mono text-sm"
                placeholder={isAr
                  ? '# عنوان رئيسي\n\nاكتب هون... تقدر تستخدم **بولد**، *مائل*، [رابط](https://...)، ![صورة](https://...)، و- نقاط.'
                  : '# Heading\n\nWrite here... you can use **bold**, *italic*, [link](https://...), ![image](https://...), and - bullets.'}
              />
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2 text-muted-foreground font-medium">
            <Search className="w-4 h-4" />
            {isAr ? 'إعدادات SEO (اختياري)' : 'SEO settings (optional)'}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 pt-0">
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">{isAr ? 'عنوان الصفحة لقوقل (افتراضياً نفس العنوان)' : 'Google page title (defaults to the title)'}</Label>
            <Input value={metaTitle} onChange={e => setMetaTitle(e.target.value)} placeholder={title} />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">{isAr ? 'وصف الصفحة لقوقل (افتراضياً نفس المقتطف)' : 'Google meta description (defaults to the excerpt)'}</Label>
            <Textarea value={metaDescription} onChange={e => setMetaDescription(e.target.value)} rows={2} placeholder={excerpt} />
          </div>
        </CardContent>
      </Card>

      <div className="fixed bottom-0 inset-x-0 lg:inset-x-64 bg-background/95 backdrop-blur border-t border-border/50 p-4 flex items-center justify-end gap-2 z-20">
        <Button variant="outline" onClick={() => handleSave(false)} disabled={saving} className="gap-2">
          {saving && <Loader2 className="w-4 h-4 animate-spin" />}
          {isAr ? 'حفظ كمسودة' : 'Save as draft'}
        </Button>
        <Button onClick={() => handleSave(true)} disabled={saving} className="gap-2">
          {saving && <Loader2 className="w-4 h-4 animate-spin" />}
          {isAr ? 'نشر' : 'Publish'}
        </Button>
      </div>
    </motion.div>
  );
}
