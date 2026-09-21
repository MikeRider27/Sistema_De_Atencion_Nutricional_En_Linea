import Layout from "@/components/Layout";
import MedicionesPanel from "@/components/panels/MedicionesPanel";
import { useAuth } from "@/lib/auth";

export default function Progreso() {
  const { user } = useAuth();
  return <Layout titulo="Mi progreso" roles={["paciente"]}>{user?.paciente_id && <MedicionesPanel pacienteId={user.paciente_id} />}</Layout>;
}
