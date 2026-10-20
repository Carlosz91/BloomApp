import * as React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';

export default function App() {
  const services = [
    { id: 1, name: 'Corte de cejas', price: 45, description: 'Corte y forma' },
    { id: 2, name: 'Tinte de cejas', price: 30, description: 'Tinte y mantenimiento' },
    { id: 3, name: 'Laminado de cejas', price: 55, description: 'Laminado y arreglo' },
    { id: 4, name: 'Limpieza facial', price: 70, description: 'Limpieza profunda' },
  ];

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>BloomApp</Text>
        <Text style={styles.subtitle}>Agenda tus citas</Text>
      </View>

      {services.map((service) => (
        <TouchableOpacity key={service.id} style={styles.serviceCard} onPress={() => alert(`Servicio: ${service.name}\nPrecio: $${service.price}`)}>
          <View style={styles.serviceInfo}>
            <Text style={styles.serviceName}>{service.name}</Text>
            <Text style={styles.servicePrice}>$${service.price}</Text>
            <Text style={styles.serviceDesc}>{service.description}</Text>
          </View>
        </TouchableOpacity>
      ))}

      <View style={styles.bottom}>
        <Text style={styles.bottomText}>Login para agendar</Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5E9DC',
    padding: 20,
  },
  header: {
    alignItems: 'center',
    paddingBottom: 20,
    borderBottomWidth: 1,
    borderColor: '#D1D5DB',
    marginBottom: 20,
  },
  title: {
    color: '#6B3752',
    fontSize: 28,
    fontWeight: '600',
  },
  subtitle: {
    color: '#8F9B96',
    fontSize: 14,
    marginTop: 4,
  },
  serviceCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  serviceInfo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  serviceName: {
    color: '#6B3752',
    fontSize: 16,
    fontWeight: '600',
  },
  servicePrice: {
    color: '#6B3752',
    fontSize: 14,
  },
  serviceDesc: {
    color: '#8F9B96',
    fontSize: 12,
    marginTop: 2,
  },
  bottom: {
    marginTop: 30,
    paddingTop: 20,
    borderTopWidth: 1,
    borderColor: '#D1D5DB',
    alignItems: 'center',
  },
  bottomText: {
    color: '#8F9B96',
    fontSize: 14,
  },
});