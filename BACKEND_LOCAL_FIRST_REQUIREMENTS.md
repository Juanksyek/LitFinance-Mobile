# Requisitos backend para LitFinance local-first

Fecha: 2026-06-30

## Objetivo

Soportar una app mobile donde la UX/UI anterior se mantiene, pero los datos diarios viven primero en SQLite del dispositivo.

El backend debe funcionar como:

- autenticacion;
- configuracion remota;
- respaldo;
- sincronizacion;
- resolucion de IDs;
- validacion de cuenta;
- fuente de datos para reinstalacion o cambio de dispositivo.

El backend no debe ser requisito para registrar acciones diarias como gastos, ingresos, metas, subcuentas o presupuesto.

## Flujo esperado

```text
usuario usa la app
-> app guarda en SQLite
-> app encola operacion local
-> usuario toca "Sincronizar"
-> app manda operaciones al backend
-> backend aplica idempotentemente
-> backend responde resultados por operacion
-> app guarda serverIds/cursor
-> app descarga cambios remotos
```

## Principios obligatorios

- Las operaciones deben ser idempotentes.
- El backend debe aceptar IDs locales del cliente.
- El backend debe devolver `serverEntityId` para mapear entidades.
- Una operacion fallida no debe bloquear todo el batch.
- Los conflictos deben responderse por operacion.
- El backend debe permitir pull incremental por cursor.
- Deletes deben sincronizarse como soft delete/tombstone.
- La app debe poder sincronizar manualmente, no solo automatico.

## Endpoints necesarios

### 1. Configuracion de version

```http
GET /version/config
```

Respuesta recomendada:

```json
{
  "mode": "full",
  "minimumAppVersion": "1.0.0",
  "latestAppVersion": "1.0.0",
  "features": {
    "mobileSync": true,
    "dashboardLite": false,
    "goals": true,
    "subaccounts": true,
    "recurrentes": true,
    "ocr": true,
    "creditCards": true,
    "sharedSpaces": true,
    "blocs": true,
    "reports": true,
    "stripe": true,
    "premium": true,
    "pushNotifications": true,
    "advancedAnalytics": true,
    "multiCurrency": true
  }
}
```

Regla:

```text
Para conservar la UX anterior, mode debe ser "full" salvo que se quiera forzar modo Lite explicitamente.
```

### 2. Bootstrap mobile

```http
GET /mobile/bootstrap
```

Uso:

- despues de login;
- al reinstalar app;
- al iniciar en un dispositivo nuevo;
- despues de reset de cuenta;
- cuando no exista cursor local.

Respuesta recomendada:

```json
{
  "serverTime": "2026-06-30T18:00:00.000Z",
  "cursor": "cursor_001",
  "user": {
    "id": "user_123",
    "email": "user@example.com",
    "name": "User"
  },
  "settings": {
    "baseCurrency": "MXN",
    "manualSync": true
  },
  "features": {},
  "entities": {
    "transactions": [],
    "categories": [],
    "budgets": [],
    "goals": [],
    "subaccounts": [],
    "recurrings": [],
    "accounts": []
  }
}
```

Reglas:

- Debe devolver un snapshot suficiente para reconstruir SQLite local.
- Debe incluir `serverId` y `updatedAt` por entidad.
- Debe incluir entidades eliminadas recientes si hacen falta para consistencia.
- Debe incluir cursor inicial para pull incremental.
- Para subcuentas local-first, debe incluir subcuentas, movimientos/transacciones asociados y recurrentes suficientes para abrir detalles sin consultar endpoints legacy.

### 3. Push de operaciones locales

```http
POST /mobile/sync/push
```

Request:

```json
{
  "deviceId": "device_abc",
  "operations": [
    {
      "clientOperationId": "op_transaction_001",
      "entity": "transaction",
      "action": "create",
      "clientEntityId": "local_trx_001",
      "serverEntityId": null,
      "payload": {
        "type": "expense",
        "amount": 180,
        "currency": "MXN",
        "categoryId": "local_cat_default_food",
        "categoryName": "Comida",
        "description": "Comida",
        "date": "2026-06-30T18:00:00.000Z",
        "subaccountId": null
      },
      "createdAt": "2026-06-30T18:01:00.000Z"
    }
  ]
}
```

Respuesta:

```json
{
  "serverTime": "2026-06-30T18:02:00.000Z",
  "results": [
    {
      "clientOperationId": "op_transaction_001",
      "clientEntityId": "local_trx_001",
      "serverEntityId": "trx_789",
      "status": "applied",
      "updatedAt": "2026-06-30T18:02:00.000Z"
    }
  ]
}
```

Estados permitidos por operacion:

```text
applied
success
retryable
conflict
rejected
failed
```

Reglas:

- `clientOperationId` debe ser unico por usuario/dispositivo.
- Cada operacion enviada debe devolver un resultado en `results` u `operations`.
- Si el frontend no encuentra resultado por `clientOperationId`, deja esa operacion en `retryable`.
- Si llega dos veces el mismo `clientOperationId`, el backend debe devolver el mismo resultado sin duplicar.
- Si una operacion falla, el backend debe procesar las demas.
- `retryable=true` o `status=retryable` indica error temporal.
- `status=conflict` no debe reintentarse automaticamente.
- `serverEntityId` debe devolverse en create exitoso.
- El resultado debe empatar por `clientOperationId`; el frontend tolera `operationId` o `clientEntityId` como fallback.
- Para subcuentas local-first, backend debe aceptar `subaccount`, `transaction` y `recurring` en create/update/delete.

### 4. Pull incremental

```http
GET /mobile/sync?since=<cursor>&limit=100
```

Con paginacion:

```http
GET /mobile/sync?since=<cursor_original>&limit=100&cursor=<continuation_token>
```

Respuesta:

```json
{
  "serverTime": "2026-06-30T18:05:00.000Z",
  "changes": [
    {
      "entity": "transaction",
      "action": "upsert",
      "serverEntityId": "trx_789",
      "clientEntityId": "local_trx_001",
      "data": {},
      "updatedAt": "2026-06-30T18:02:00.000Z"
    },
    {
      "entity": "goal",
      "action": "delete",
      "serverEntityId": "goal_123",
      "deletedAt": "2026-06-30T18:04:00.000Z"
    }
  ],
  "hasMore": false,
  "cursor": null,
  "nextCursor": "cursor_002"
}
```

Reglas:

- `nextCursor` solo debe usarse cuando `hasMore=false`.
- El frontend aplicara deletes antes de upserts.
- El backend debe ordenar cambios de forma estable.
- El cursor debe ser monotono y seguro para reintentos.
- Si el mismo pull se repite, debe devolver resultados consistentes.

## Entidades que debe soportar sync

### MVP principal

```text
transaction
category
budget
goal
subaccount
account
```

### Siguientes modulos

```text
recurring
creditCard
creditCardMovement
ticket
sharedSpace
sharedSpaceMovement
bloc
blocItem
report
user_settings
```

Nota:

```text
Estos son los nombres exactos que envia el frontend en operation.entity.
Si el backend usa snake_case internamente, debe mapearlos sin rechazar el batch.
```

## Acciones soportadas

```text
create
update
delete
```

Para pull:

```text
upsert
delete
```

## Campos minimos por entidad

### transaction

```json
{
  "id": "trx_789",
  "clientEntityId": "local_trx_001",
  "type": "expense",
  "amount": 180,
  "currency": "MXN",
  "categoryId": "cat_food",
  "categoryName": "Comida",
  "description": "Comida",
  "date": "2026-06-30T18:00:00.000Z",
  "accountId": "account_main",
  "subaccountId": null,
  "createdAt": "2026-06-30T18:00:00.000Z",
  "updatedAt": "2026-06-30T18:02:00.000Z",
  "deletedAt": null
}
```

### category

```json
{
  "id": "cat_food",
  "clientEntityId": "local_cat_default_food",
  "name": "Comida",
  "color": "#EF7725",
  "icon": "restaurant",
  "type": "expense",
  "isDefault": true,
  "createdAt": "2026-06-30T18:00:00.000Z",
  "updatedAt": "2026-06-30T18:00:00.000Z",
  "deletedAt": null
}
```

### budget

```json
{
  "id": "budget_2026_06",
  "clientEntityId": "local_budget_2026_06",
  "month": "2026-06",
  "incomePlanned": 30000,
  "savingsTarget": 5000,
  "spendingLimit": 25000,
  "currency": "MXN",
  "createdAt": "2026-06-30T18:00:00.000Z",
  "updatedAt": "2026-06-30T18:00:00.000Z",
  "deletedAt": null
}
```

### goal

```json
{
  "id": "goal_123",
  "clientEntityId": "local_goal_abc",
  "name": "Fondo de emergencia",
  "targetAmount": 10000,
  "currentAmount": 1500,
  "currency": "MXN",
  "targetDate": "2026-12-31",
  "createdAt": "2026-06-30T18:00:00.000Z",
  "updatedAt": "2026-06-30T18:00:00.000Z",
  "deletedAt": null
}
```

### subaccount

```json
{
  "id": "sub_123",
  "clientEntityId": "local_subaccount_abc",
  "name": "Viajes",
  "balance": 2500,
  "currency": "MXN",
  "createdAt": "2026-06-30T18:00:00.000Z",
  "updatedAt": "2026-06-30T18:00:00.000Z",
  "deletedAt": null
}
```

## Conflictos

Para updates/deletes, frontend enviara:

```json
{
  "baseUpdatedAt": "2026-06-30T18:00:00.000Z"
}
```

Backend debe comparar `baseUpdatedAt` contra la version actual.

Si no coincide:

```json
{
  "clientOperationId": "op_goal_update_001",
  "clientEntityId": "local_goal_abc",
  "serverEntityId": "goal_123",
  "status": "conflict",
  "code": "SYNC_CONFLICT",
  "message": "La entidad fue modificada en otro dispositivo.",
  "data": {
    "server": {
      "id": "goal_123",
      "name": "Fondo emergencia",
      "updatedAt": "2026-06-30T19:00:00.000Z"
    }
  }
}
```

Regla MVP:

- backend conserva version servidor;
- frontend marca conflicto;
- usuario puede editar despues sobre la version actual.

## Deletes

No borrar fisicamente de inmediato.

Usar soft delete:

```text
deletedAt != null
```

Motivo:

- otros dispositivos necesitan recibir el delete en pull;
- evita reaparicion de datos eliminados;
- permite auditoria basica.

Politica sugerida:

```text
mantener tombstones 30 a 90 dias
```

## Autenticacion

Se mantiene login/registro actual.

Requisitos:

- todos los endpoints sync usan `Authorization: Bearer <token>`;
- 401 debe indicar sesion expirada;
- refresh token debe seguir funcionando si ya existe;
- sync no debe aceptar operaciones de otro usuario;
- `deviceId` debe asociarse al usuario autenticado.

Headers recomendados:

```http
Authorization: Bearer <token>
X-Device-ID: device_abc
X-App-Version: 1.0.0
X-Platform: ios|android
```

## Sync manual

Backend no necesita diferenciar manual vs automatico para aplicar operaciones.

Pero debe soportar que el frontend haga:

```text
push pending
pull changes
```

solo cuando el usuario toque "Sincronizar".

No asumir que la app estara sincronizando en background.

## Errores esperados

Formato recomendado:

```json
{
  "code": "VALIDATION_ERROR",
  "message": "Monto invalido.",
  "details": {}
}
```

Codigos utiles:

```text
AUTH_EXPIRED
VALIDATION_ERROR
RATE_LIMITED
SYNC_CONFLICT
SYNC_RETRYABLE
ENTITY_NOT_FOUND
ENTITY_DELETED
DEVICE_NOT_ALLOWED
SERVER_ERROR
```

## Idempotencia

Tabla o registro backend sugerido:

```text
sync_operations
  id
  user_id
  device_id
  client_operation_id
  entity
  action
  client_entity_id
  server_entity_id
  payload_hash
  status
  result_json
  created_at
  updated_at
```

Indice unico:

```text
(user_id, client_operation_id)
```

Si la misma operacion llega de nuevo:

- no aplicar dos veces;
- devolver `result_json` anterior;
- no crear duplicados.

## Mapeo de IDs

Backend debe guardar relacion:

```text
user_id
entity
client_entity_id
server_entity_id
device_id
created_at
```

Esto permite:

- updates posteriores con ID local;
- respuestas consistentes;
- evitar duplicados entre reintentos.

## Orden recomendado de implementacion backend

### Fase 1

```text
[ ] GET /version/config con mode=full.
[ ] GET /mobile/bootstrap para entidades principales.
[ ] POST /mobile/sync/push con idempotencia.
[ ] GET /mobile/sync con cursor incremental.
```

### Fase 2

```text
[ ] transaction create/update/delete.
[ ] category create/update/delete para conceptos personalizados.
[ ] budget create/update/delete.
[ ] goal create/update/delete.
[ ] subaccount create/update/delete.
[ ] account snapshot.
```

## Conceptos personalizados

El frontend ya no necesita endpoints legacy `/conceptos` para el uso diario.

Contrato necesario:

```text
POST /mobile/sync/push entity=category action=create|update|delete
GET /mobile/bootstrap debe incluir categories/conceptos iniciales
GET /mobile/sync debe incluir cambios incrementales de categories/conceptos
```

Reglas esperadas:

- `create` debe aceptar `clientEntityId` y devolver `serverEntityId`;
- `update` debe aceptar `clientEntityId` o `serverEntityId`;
- `delete` debe aceptar tombstone por `clientEntityId` o `serverEntityId`;
- los payloads pueden traer `name/nombre`, `icon/icono`, `color` y `type`;
- el backend debe mantener idempotencia por `clientOperationId`;
- no se debe requerir `GET /conceptos` para que el frontend pueda listar o usar conceptos ya sincronizados.

## Graficas, estadisticas y saldos

El frontend calcula graficas/estadisticas/saldos desde SQLite.

No son necesarios para uso diario:

```text
GET /analytics/*
GET /dashboard/snapshot
GET /dashboard/expenses-chart
GET /dashboard/balance-card
```

Lo que si debe llegar por bootstrap/pull:

- `transactions` completos o incrementales;
- `categories/conceptos`;
- `subaccounts`;
- `recurrings`;
- `account` o `accountSummary` con `cuentaId`, `moneda` y `saldo` base;
- tombstones para deletes.

Sin `account/accountSummary`, el frontend puede mostrar saldo derivado desde movimientos locales, pero no puede reconstruir con precision el saldo historico inicial de cuenta principal en un dispositivo nuevo.

Si backend envia `accountSummary.saldo`, el frontend lo interpreta como saldo actual materializado que ya incluye transacciones sincronizadas. Encima de ese saldo solo suma movimientos locales no sincronizados para evitar doble conteo despues de bootstrap/pull.

## Movimientos recientes

El frontend ya no necesita endpoints legacy para historial/transacciones durante el uso diario.

No son necesarios para el flujo local-first:

```text
GET /cuenta-historial
GET /transacciones
PATCH /transacciones/*
DELETE /transacciones/*
```

Contrato necesario:

```text
POST /mobile/sync/push entity=transaction action=create|update|delete
GET /mobile/bootstrap debe incluir transactions iniciales
GET /mobile/sync debe incluir transactions incrementales y tombstones
```

Reglas esperadas:

- `create` debe devolver `serverEntityId`;
- `update` debe aceptar `clientEntityId` o `serverEntityId`;
- `delete` debe aceptar tombstone por `clientEntityId` o `serverEntityId`;
- el backend debe aplicar idempotencia por `clientOperationId`;
- pull debe devolver cambios hechos desde otro dispositivo para actualizar SQLite.

## Cuenta principal y moneda

El frontend guarda `accountSummary` localmente y sube cambios por sync manual.

No son necesarios para uso diario:

```text
GET /cuenta/principal
GET /monedas
GET /cuenta/preview-currency-change
PATCH /cuenta/editar-principal
```

Contrato necesario:

```text
POST /mobile/sync/push entity=account action=update
GET /mobile/bootstrap debe incluir account/accountSummary
GET /mobile/sync debe incluir account/accountSummary incremental
```

Payload esperado para `account/update`:

- `currency` o `moneda`;
- `saldo` base si backend lo requiere;
- `baseUpdatedAt` para conflicto optimista.

Recomendacion: documentar si `saldo` es saldo actual materializado o saldo inicial historico. La app ya asume saldo actual materializado para `accountSummary` de bootstrap/pull.

### Fase 3

```text
[ ] conflictos con baseUpdatedAt.
[ ] tombstones para deletes.
[ ] auditoria de sync_operations.
[ ] metricas/logs por dispositivo.
```

### Fase 4

```text
[ ] recurrentes: aceptar recurring/create, recurring/update y recurring/delete desde /mobile/sync/push.
[ ] tarjetas.
[ ] tickets/OCR.
[ ] shared spaces.
[ ] BLOCs.
[ ] reportes.
```

## Catalogo de plataformas recurrentes

El frontend ya puede funcionar sin endpoint nuevo porque cachea plataformas en SQLite.

Contrato opcional recomendado:

```text
GET /plataformas-recurrentes
```

Uso esperado:

- se llama solo como hidratacion inicial o refresco manual;
- debe devolver lista estable con `id` o `plataformaId`, `nombre`, `categoria` y `color`;
- no debe ser necesario para crear/listar/editar/pausar/eliminar recurrentes;
- si se desea versionado, incluir `updatedAt` o `version` para que frontend pueda refrescar el catalogo sin pedirlo siempre.

Para recurrentes, lo critico sigue siendo mobile sync:

```text
POST /mobile/sync/push entity=recurring action=create|update|delete
GET /mobile/bootstrap debe incluir recurrings iniciales
GET /mobile/sync debe incluir cambios incrementales de recurrings
```

## Criterios de aceptacion

El backend esta listo para local-first cuando:

```text
[ ] Login/registro siguen funcionando.
[ ] /version/config devuelve full por defecto.
[ ] /mobile/bootstrap reconstruye SQLite inicial.
[ ] /mobile/sync/push acepta batch idempotente.
[ ] /mobile/sync/push responde por operacion.
[ ] Creates devuelven serverEntityId.
[ ] Updates/deletes aceptan clientEntityId o serverEntityId.
[ ] Conflicts se devuelven sin romper todo el batch.
[ ] Retryable errors se distinguen de errores definitivos.
[ ] /mobile/sync soporta cursor incremental.
[ ] Deletes llegan al pull como tombstones.
[ ] Un reintento no duplica datos.
[ ] Otro dispositivo puede reconstruir datos con bootstrap + pull.
```

## Nota importante

El backend no debe intentar replicar la UX Lite.

El objetivo actual es:

```text
UX anterior completa
+ SQLite local
+ backend como sync/respaldo
```
