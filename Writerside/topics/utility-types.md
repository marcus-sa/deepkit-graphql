# Utility Types
## Omit
Type
```typescript
interface User {
  id: string;
  username: string;
}
```
Usage
```typescript
Omit<User, 'username'>
```
Result
```
type OmitUserid {
  id: String!
}
```
## Pick
Type
```typescript
interface User {
  id: string;
  username: string;
}
```
Usage
```typescript
Pick<User, 'id'>
```
Result
```
type PickUserid {
  id: String!
}
```

## Intersection

## Partial
