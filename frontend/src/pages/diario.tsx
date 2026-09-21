import Layout from "@/components/Layout";
import DiarioPanel from "@/components/panels/DiarioPanel";

export default function Diario() {
  return <Layout titulo="Diario de alimentos" roles={["paciente"]}><DiarioPanel editable /></Layout>;
}
