import React from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    Dimensions,
    Platform,
} from 'react-native';
// Using standard RN components to avoid external icon dependency issues
// A simple CSS-art style WiFi icon or just a clean message

interface NoInternetScreenProps {
    onRetry: () => void;
    isRetrying?: boolean;
}

const { width } = Dimensions.get('window');

const NoInternetScreen: React.FC<NoInternetScreenProps> = ({ onRetry, isRetrying }) => {
    return (
        <View style={styles.container}>
            <View style={styles.contentContainer}>
                {/* Visual Indicator of No Internet */}
                <View style={styles.iconContainer}>
                    <View style={styles.iconCircle}>
                        <Text style={styles.iconText}>!</Text>
                    </View>
                    <View style={[styles.signalArc, styles.signalArcLarge]} />
                    <View style={[styles.signalArc, styles.signalArcMedium]} />
                    <View style={[styles.signalArc, styles.signalArcSmall]} />
                </View>

                <Text style={styles.title}>No Internet Connection</Text>
                <Text style={styles.message}>
                    Please check your internet settings and try again.
                </Text>

                <TouchableOpacity
                    style={styles.button}
                    onPress={onRetry}
                    activeOpacity={0.8}
                    disabled={isRetrying}
                >
                    <Text style={styles.buttonText}>
                        {isRetrying ? 'Checking...' : 'Try Again'}
                    </Text>
                </TouchableOpacity>
            </View>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: '#fff',
        justifyContent: 'center',
        alignItems: 'center',
        zIndex: 9999,
    },
    contentContainer: {
        alignItems: 'center',
        paddingHorizontal: 30,
        width: '100%',
    },
    iconContainer: {
        width: 100,
        height: 100,
        marginBottom: 30,
        justifyContent: 'center',
        alignItems: 'center',
    },
    iconCircle: {
        width: 20,
        height: 20,
        borderRadius: 10,
        backgroundColor: '#FF5252', // Red warning color
        position: 'absolute',
        bottom: 20,
        justifyContent: 'center',
        alignItems: 'center',
        zIndex: 2,
    },
    iconText: {
        color: 'white',
        fontWeight: 'bold',
        fontSize: 14,
    },
    signalArc: {
        position: 'absolute',
        borderTopColor: '#ddd',
        borderTopWidth: 4,
        borderRadius: 999,
    },
    signalArcLarge: {
        width: 80,
        height: 80,
        bottom: 10,
    },
    signalArcMedium: {
        width: 50,
        height: 50,
        bottom: 0,
    },
    signalArcSmall: {
        width: 20,
        height: 20,
        bottom: -10,
        opacity: 0,
    },
    title: {
        fontSize: 22,
        fontWeight: 'bold',
        color: '#333',
        marginBottom: 10,
        textAlign: 'center',
    },
    message: {
        fontSize: 16,
        color: '#666',
        textAlign: 'center',
        marginBottom: 40,
        lineHeight: 22,
    },
    button: {
        backgroundColor: '#007AFF', // Standard iOS Blue
        paddingVertical: 14,
        paddingHorizontal: 36,
        borderRadius: 25,
        shadowColor: '#000',
        shadowOffset: {
            width: 0,
            height: 2,
        },
        shadowOpacity: 0.25,
        shadowRadius: 3.84,
        elevation: 5,
    },
    buttonText: {
        color: 'white',
        fontSize: 16,
        fontWeight: '600',
    },
});

export default NoInternetScreen;
