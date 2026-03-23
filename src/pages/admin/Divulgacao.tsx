import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import EstoqueRelatorio from "@/components/admin/EstoqueRelatorio";
import ClientesInativosRelatorio from "@/components/admin/ClientesInativosRelatorio";
import CampanhaRelatorio from "@/components/admin/CampanhaRelatorio";

const Divulgacao = () => {
  return (
    <div className="space-y-4">
      <h1 className="text-xl sm:text-2xl font-bold">Divulgação</h1>
      <Tabs defaultValue="estoque">
        <TabsList className="flex-wrap h-auto">
          <TabsTrigger value="estoque">Estoque</TabsTrigger>
          <TabsTrigger value="clientes">Clientes Inativos</TabsTrigger>
          <TabsTrigger value="campanha">Campanha</TabsTrigger>
        </TabsList>
        <TabsContent value="estoque">
          <EstoqueRelatorio />
        </TabsContent>
        <TabsContent value="clientes">
          <ClientesInativosRelatorio inline />
        </TabsContent>
        <TabsContent value="campanha">
          <CampanhaRelatorio inline />
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default Divulgacao;
