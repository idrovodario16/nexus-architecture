# Decisiones de arquitectura

## ADR-001 · Monolitos modulares por producto
Estado: aceptado. Facilitan desarrollo individual, transacciones claras y pruebas sin operar una red de servicios. Extraer servicios solo por escalamiento, autonomía o límites de dominio demostrados.

## ADR-002 · Bases separadas y vistas materializadas por consumidor
Core es fuente operacional. Insight es dueño de su facts y no puede modificar operaciones fuente. No hay joins entre bases ni dependencias de arranque.

## ADR-003 · Outbox/inbox y snapshots v1
Evento snapshot completo y revisión creciente, útil para replay y tolerancia a desorden. Entrega al menos una vez. UUID de evento deduplica transporte; clave organización+operación y revision deduplican estado. Un evento con distinto ID pero misma revisión no modifica facts. El productor es responsable de no emitir contenidos contradictorios para la misma revisión.

## ADR-004 · Cursor confirmado después del consumo
Core bloquea por organización durante la escritura transaccional: no se salta un evento cuyo sequence se haya asignado antes pero confirme después. Relay persiste cursor solo tras POST exitoso; tres intentos para fallas temporales, timeout y backoff. Un lote inválido o 4xx permanente detiene el avance para corrección manual. No hay DLQ automática en el MVP.

## ADR-005 · Separación demo/backend
Pages sirve una aplicación estática y no contiene claves. El visitante usa localStorage y transporte JSON explícito. Las APIs con PostgreSQL se prueban con HTTP y scripts. Nunca presentar la demo como una API desplegada ni como multiusuario.

## ADR-006 · Seguridad incremental
Una credencial por instancia asociada a una organización. Validación de tenant y SQL parametrizado. Puertos locales en loopback. Este acceso de servicio es suficiente para una demostración local; no reemplaza identidad de usuarios, RBAC, aislamiento de producción, TLS ni gestión de secretos.

## Versionado
v1 agrega snapshots sin borrados físicos, USD en centavos y cuatro estados. No se agregan campos silenciosamente porque los validadores rechazan extras. Cambios incompatibles crean v2, mantienen consumidores v1 durante una transición y prueban compatibilidad. JSON Schema se usa para validar fixtures; invariantes de igualdad de tenant y revisión se comprueban en código.
