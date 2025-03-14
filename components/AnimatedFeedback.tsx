import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Animated, {FadeIn, FadeInDown, FadeInUp, FadeOut} from 'react-native-reanimated';
import { useDebounceEffect } from 'ahooks';

const MIN_VISIBLE_DURATION = 1000; // Durée minimale en ms (1 seconde)
const INACTIVITY_DURATION = 3000; // 3 secondes sans changement dans la liste

const AnimatedMessage = ({ message, onRemove }) => {
    return (
        <Animated.View
            key={message} // Clé unique pour chaque message
            entering={FadeInDown.duration(250)}  // Animation d'entrée
            exiting={FadeOut.duration(300)}  // Animation de sortie
            style={styles.messageContainer}
        >
            <View style={styles.container}>
                <Text style={styles.messageText}>{message}</Text>
            </View>
        </Animated.View>
    );
};

const MessageList = ({ messages }) => {
    const [currentMessage, setCurrentMessage] = useState(messages[0] || null);
    const [debouncedMessage, setDebouncedMessage] = useState(currentMessage);
    const [showMessage, setShowMessage] = useState(true);  // Contrôle l'affichage du message
    const [lastUpdated, setLastUpdated] = useState(Date.now()); // Garder une trace du dernier changement

    // Met à jour immédiatement si la liste est vide ou si aucun message n'est affiché
    useEffect(() => {
        if (messages.length > 0 && !debouncedMessage) {
            setCurrentMessage(messages[0]);
            setDebouncedMessage(messages[0]);
        }
    }, [messages, debouncedMessage]);

    // Utiliser useDebounceEffect pour retarder la mise à jour si un message est déjà affiché
    useDebounceEffect(
        () => {
            if (currentMessage) {
                setDebouncedMessage(currentMessage);
            }
        },
        [currentMessage],
        { wait: MIN_VISIBLE_DURATION }
    );

    useEffect(() => {
        if (messages.length > 0) {
            setCurrentMessage(messages[0]);
            setShowMessage(true);  // Affiche immédiatement quand un message arrive
            setLastUpdated(Date.now()); // Réinitialise le timer à chaque message
        } else {
            // Lorsqu'il n'y a plus de message, on lance la disparition avec un délai
            setShowMessage(false);
        }
    }, [messages]);

    useEffect(() => {
        const timer = setTimeout(() => {
            // Si aucun changement dans les messages après INACTIVITY_DURATION, cacher le message
            if (Date.now() - lastUpdated >= INACTIVITY_DURATION) {
                setShowMessage(false);
            }
        }, INACTIVITY_DURATION);

        return () => clearTimeout(timer);  // Clean up le timer au cas où un changement survient avant les 3 secondes
    }, [lastUpdated]); // Se déclenche chaque fois que `lastUpdated` change

    const handleRemoveMessage = () => {
        // Une fois l'animation terminée, on supprime le message
        setCurrentMessage(null);
    };

    return (
        <>
            {showMessage && debouncedMessage && (
                <AnimatedMessage message={debouncedMessage} onRemove={handleRemoveMessage} />
            )}
        </>
    );
};

const styles = StyleSheet.create({
    container: {
        paddingVertical: 5,
        paddingHorizontal: 10,
        borderRadius: 500,
        backgroundColor: '#00000055',
        flex: 1,
    },
    messageText: {
        color: 'white',
        fontWeight: 'bold',
        fontSize: 17,
    },
    messageContainer: {
        marginBottom: 10, // Espacement entre les messages
    },
});

export default MessageList;
