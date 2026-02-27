import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Plus, Trash2, GripVertical, Package } from "lucide-react";

interface Imagem {
  produto_imagem_id: string;
  url_imagem: string;
  ordem: number;
}

interface ProdutoImageUploadProps {
  produtoId: string;
}

const ProdutoImageUpload = ({ produtoId }: ProdutoImageUploadProps) => {
  const [imagens, setImagens] = useState<Imagem[]>([]);
  const [uploading, setUploading] = useState(false);
  const { toast } = useToast();

  const loadImagens = async () => {
    const { data } = await supabase
      .from("produto_imagem")
      .select("*")
      .eq("produto_id", produtoId)
      .order("ordem");
    if (data) setImagens(data);
  };

  useEffect(() => {
    loadImagens();
  }, [produtoId]);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setUploading(true);
    const currentMax = imagens.length > 0 ? Math.max(...imagens.map((i) => i.ordem)) : -1;

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const ext = file.name.split(".").pop();
      const path = `${produtoId}/${Date.now()}-${i}.${ext}`;

      const { error: uploadError } = await supabase.storage
        .from("produtos")
        .upload(path, file);

      if (uploadError) {
        toast({ title: "Erro no upload", description: uploadError.message, variant: "destructive" });
        continue;
      }

      const { data: urlData } = supabase.storage.from("produtos").getPublicUrl(path);

      await supabase.from("produto_imagem").insert({
        produto_id: produtoId,
        url_imagem: urlData.publicUrl,
        ordem: currentMax + 1 + i,
      });
    }

    setUploading(false);
    toast({ title: `${files.length} imagem(ns) adicionada(s)` });
    loadImagens();
    e.target.value = "";
  };

  const handleDelete = async (img: Imagem) => {
    // Extract path from URL
    const urlParts = img.url_imagem.split("/produtos/");
    if (urlParts[1]) {
      await supabase.storage.from("produtos").remove([urlParts[1]]);
    }
    await supabase.from("produto_imagem").delete().eq("produto_imagem_id", img.produto_imagem_id);
    toast({ title: "Imagem removida" });
    loadImagens();
  };

  return (
    <div className="space-y-3">
      <Label>Imagens do produto</Label>
      <div className="grid grid-cols-3 gap-2">
        {imagens.map((img) => (
          <div key={img.produto_imagem_id} className="relative group rounded-lg overflow-hidden border bg-muted aspect-square">
            <img src={img.url_imagem} alt="" className="h-full w-full object-cover" />
            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
              <Button size="icon" variant="destructive" className="h-8 w-8" onClick={() => handleDelete(img)}>
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
            <span className="absolute top-1 left-1 bg-background/80 text-xs px-1.5 py-0.5 rounded">
              {img.ordem + 1}
            </span>
          </div>
        ))}
        <label className="border-2 border-dashed rounded-lg aspect-square flex flex-col items-center justify-center cursor-pointer hover:border-primary transition-colors text-muted-foreground hover:text-primary">
          <Plus className="h-6 w-6 mb-1" />
          <span className="text-xs">{uploading ? "Enviando..." : "Adicionar"}</span>
          <input
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            onChange={handleUpload}
            disabled={uploading}
          />
        </label>
      </div>
    </div>
  );
};

export default ProdutoImageUpload;
