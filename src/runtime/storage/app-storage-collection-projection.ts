import {
  extractMessengerMessages,
  toMessengerThreadRecord,
} from "../../engine/messenger";
import {
  extractRoleplayEntries,
  toRoleplayThreadRecord,
} from "../../engine/roleplay";
import type {
  AppStorageCollectionKey,
  AppStorageRecords,
} from "./app-storage-snapshot";

function assertNeverAppStorageCollectionKey(
  collectionKey: never,
): never {
  throw new Error(`Unhandled app storage collection: ${collectionKey}`);
}

export function appStorageCollectionSignature(
  snapshot: AppStorageRecords,
  collectionKey: AppStorageCollectionKey,
): string {
  switch (collectionKey) {
    case "appSettings":
      return JSON.stringify(snapshot.appSettings) ?? "null";
    case "characters":
      return JSON.stringify(snapshot.characters) ?? "null";
    case "personas":
      return JSON.stringify(snapshot.personas) ?? "null";
    case "lorebooks":
      return JSON.stringify(snapshot.lorebooks) ?? "null";
    case "providerConnections":
      return JSON.stringify(snapshot.providerConnections) ?? "null";
    case "roleplayThreads":
      return JSON.stringify(snapshot.roleplayThreads.map(toRoleplayThreadRecord));
    case "roleplayEntries":
      return JSON.stringify(extractRoleplayEntries(snapshot.roleplayThreads));
    case "messengerThreads":
      return JSON.stringify(
        snapshot.messengerThreads.map(toMessengerThreadRecord),
      );
    case "messengerMessages":
      return JSON.stringify(extractMessengerMessages(snapshot.messengerThreads));
    case "rippleStates":
      return JSON.stringify(snapshot.rippleStates) ?? "null";
  }

  return assertNeverAppStorageCollectionKey(collectionKey);
}

export function appStorageCollectionCount(
  snapshot: AppStorageRecords,
  collectionKey: AppStorageCollectionKey,
): number {
  switch (collectionKey) {
    case "appSettings":
      return 1;
    case "characters":
      return snapshot.characters.length;
    case "personas":
      return snapshot.personas.length;
    case "lorebooks":
      return snapshot.lorebooks.length;
    case "providerConnections":
      return snapshot.providerConnections.length;
    case "roleplayThreads":
      return snapshot.roleplayThreads.length;
    case "roleplayEntries":
      return extractRoleplayEntries(snapshot.roleplayThreads).length;
    case "messengerThreads":
      return snapshot.messengerThreads.length;
    case "messengerMessages":
      return extractMessengerMessages(snapshot.messengerThreads).length;
    case "rippleStates":
      return snapshot.rippleStates.length;
  }

  return assertNeverAppStorageCollectionKey(collectionKey);
}

export function appStorageCollectionSource(
  snapshot: AppStorageRecords,
  collectionKey: AppStorageCollectionKey,
): unknown {
  switch (collectionKey) {
    case "appSettings":
      return snapshot.appSettings;
    case "characters":
      return snapshot.characters;
    case "personas":
      return snapshot.personas;
    case "lorebooks":
      return snapshot.lorebooks;
    case "providerConnections":
      return snapshot.providerConnections;
    case "roleplayThreads":
    case "roleplayEntries":
      return snapshot.roleplayThreads;
    case "messengerThreads":
    case "messengerMessages":
      return snapshot.messengerThreads;
    case "rippleStates":
      return snapshot.rippleStates;
  }

  return assertNeverAppStorageCollectionKey(collectionKey);
}
