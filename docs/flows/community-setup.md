# Flow: Community Setup

```
User -> Frontend -> API -> AuthN -> AuthZ -> Service -> DB txn -> Celery job -> Notification -> Audit log -> FE cache invalidation
```

_Describe each hop, the data exchanged, and failure handling._
