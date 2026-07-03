import {
  extractMessengerMessages,
  type MessengerThread,
} from "../../../engine/contracts/types/messenger";
import { createStorageRepository } from "../storage-repository-factory";
import { STORAGE_ENTITIES } from "../storage-entities";
import { normalizeMessengerMessageRecord } from "./messenger-storage";

const messengerMessageRepository = createStorageRepository({
  entity: STORAGE_ENTITIES.messengerMessages,
  normalizeRecord: normalizeMessengerMessageRecord,
  seedRecords: [],
});

export function loadMessengerMessagesFromStorage(rawUrl?: string) {
  return messengerMessageRepository.loadSnapshot(rawUrl);
}

export function saveMessengerMessagesToStorage(threads: MessengerThread[], rawUrl?: string) {
  return messengerMessageRepository.save(extractMessengerMessages(threads), rawUrl);
}
